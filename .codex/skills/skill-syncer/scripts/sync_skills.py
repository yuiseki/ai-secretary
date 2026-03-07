#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
from pathlib import Path


IGNORED_NAMES = {".git", "__pycache__", ".DS_Store"}


def latest_mtime(path: Path) -> float:
    return max(entry.stat().st_mtime for entry in [path, *path.rglob("*")])


def is_text_file(path: Path) -> bool:
    try:
        path.read_text(encoding="utf-8")
        return True
    except UnicodeDecodeError:
        return False


def normalize_text(text: str, source_root: Path, target_root: Path) -> str:
    replacements = {
        str(source_root.resolve()): str(target_root.resolve()),
        source_root.as_posix(): target_root.as_posix(),
        ".claude/skills": ".codex/skills",
        ".gemini/skills": ".codex/skills",
        "/.claude/skills": "/.codex/skills",
        "/.gemini/skills": "/.codex/skills",
    }
    normalized = text
    for old, new in replacements.items():
        normalized = normalized.replace(old, new)
    return normalized


def build_snapshot(source_dir: Path, source_root: Path | None, target_root: Path) -> dict[str, bytes]:
    snapshot: dict[str, bytes] = {}
    for entry in sorted(source_dir.rglob("*")):
        if any(part in IGNORED_NAMES for part in entry.parts):
            continue
        rel_path = entry.relative_to(source_dir).as_posix()
        if entry.is_dir():
            snapshot[f"{rel_path}/"] = b""
            continue
        if source_root is not None and is_text_file(entry):
            contents = normalize_text(
                entry.read_text(encoding="utf-8"),
                source_root,
                target_root,
            ).encode("utf-8")
        else:
            contents = entry.read_bytes()
        snapshot[rel_path] = contents
    return snapshot


def materialize_skill(source_dir: Path, source_root: Path, target_root: Path) -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix="skill-syncer-"))
    target_dir = temp_dir / source_dir.name
    target_dir.mkdir(parents=True, exist_ok=True)

    for entry in sorted(source_dir.rglob("*")):
        if any(part in IGNORED_NAMES for part in entry.parts):
            continue
        rel_path = entry.relative_to(source_dir)
        dest = target_dir / rel_path
        if entry.is_dir():
            dest.mkdir(parents=True, exist_ok=True)
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        if is_text_file(entry):
            dest.write_text(
                normalize_text(entry.read_text(encoding="utf-8"), source_root, target_root),
                encoding="utf-8",
            )
        else:
            shutil.copy2(entry, dest)
    return target_dir


def discover_newest_sources(source_roots: list[Path]) -> dict[str, tuple[Path, float]]:
    newest: dict[str, tuple[Path, float]] = {}
    for source_root in source_roots:
        if not source_root.exists():
            continue
        for skill_dir in sorted(source_root.iterdir()):
            if not skill_dir.is_dir() or not (skill_dir / "SKILL.md").exists():
                continue
            mtime = latest_mtime(skill_dir)
            current = newest.get(skill_dir.name)
            if current is None or mtime > current[1]:
                newest[skill_dir.name] = (skill_dir, mtime)
    return newest


def sync_skill_trees(source_roots: list[Path], target_root: Path, dry_run: bool = True) -> dict[str, list[str]]:
    report = {
        "copied": [],
        "updated": [],
        "skipped": [],
    }

    newest_sources = discover_newest_sources(source_roots)
    target_root.mkdir(parents=True, exist_ok=True)

    for skill_name in sorted(newest_sources):
        source_dir, source_mtime = newest_sources[skill_name]
        target_dir = target_root / skill_name
        target_mtime = latest_mtime(target_dir) if target_dir.exists() else None
        normalized_snapshot = build_snapshot(source_dir, source_dir.parent, target_root)

        if target_dir.exists():
            target_snapshot = build_snapshot(target_dir, None, target_root)
            if normalized_snapshot == target_snapshot:
                report["skipped"].append(skill_name)
                continue
            if target_mtime is not None and target_mtime >= source_mtime:
                report["skipped"].append(skill_name)
                continue
            report["updated"].append(skill_name)
        else:
            report["copied"].append(skill_name)

        if dry_run:
            continue

        staged_dir = materialize_skill(source_dir, source_dir.parent, target_root)
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(staged_dir, target_dir, copy_function=shutil.copy2)
        shutil.rmtree(staged_dir.parent)

    return report


def default_workspace_root() -> Path:
    return Path(__file__).resolve().parents[4]


def parse_args() -> argparse.Namespace:
    workspace_root = default_workspace_root()
    parser = argparse.ArgumentParser(description="Sync skills from other agent folders into .codex/skills")
    parser.add_argument(
        "--source-root",
        action="append",
        default=[],
        help="Skill source root. Can be passed multiple times.",
    )
    parser.add_argument(
        "--target-root",
        default=str(workspace_root / ".codex" / "skills"),
        help="Codex skill target root.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes. Default is dry-run.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    workspace_root = default_workspace_root()
    source_roots = (
        [Path(path) for path in args.source_root]
        if args.source_root
        else [
            workspace_root / ".claude" / "skills",
            workspace_root / ".gemini" / "skills",
        ]
    )
    report = sync_skill_trees(source_roots, Path(args.target_root), dry_run=not args.apply)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        mode = "apply" if args.apply else "dry-run"
        print(f"mode={mode}")
        for key in ("copied", "updated", "skipped"):
            values = ", ".join(report[key]) or "-"
            print(f"{key}: {values}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
