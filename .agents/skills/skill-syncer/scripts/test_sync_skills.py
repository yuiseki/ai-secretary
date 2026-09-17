#!/usr/bin/env python3

import importlib.util
import os
import tempfile
import time
import unittest
from pathlib import Path


def load_module():
    module_path = Path(__file__).with_name("sync_skills.py")
    spec = importlib.util.spec_from_file_location("sync_skills", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class SyncSkillsTest(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        self.claude_root = self.root / ".claude" / "skills"
        self.gemini_root = self.root / ".gemini" / "skills"
        self.codex_root = self.root / ".codex" / "skills"
        self.claude_root.mkdir(parents=True)
        self.gemini_root.mkdir(parents=True)
        self.codex_root.mkdir(parents=True)
        self.module = load_module()

    def tearDown(self):
        self.tmpdir.cleanup()

    def create_skill(self, base: Path, name: str, body: str, mtime: float) -> Path:
        skill_dir = base / name
        skill_dir.mkdir(parents=True)
        skill_file = skill_dir / "SKILL.md"
        skill_file.write_text(body, encoding="utf-8")
        readme = skill_dir / "notes.txt"
        readme.write_text(body, encoding="utf-8")
        for path in (skill_dir, skill_file, readme):
            os.utime(path, (mtime, mtime))
        return skill_dir

    def test_copy_new_skill_and_rewrite_agent_paths(self):
        now = time.time()
        body = (
            "---\nname: demo\ndescription: demo\n---\n"
            f"use {self.claude_root.as_posix()}/demo/SKILL.md and .claude/skills/demo\n"
        )
        self.create_skill(self.claude_root, "demo", body, now)

        report = self.module.sync_skill_trees(
            [self.claude_root, self.codex_root],
            self.gemini_root,
            dry_run=False,
        )

        self.assertEqual(report["copied"], ["demo"])
        copied = (self.gemini_root / "demo" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn(".gemini/skills/demo", copied)
        self.assertNotIn(".claude/skills/demo", copied)

    def test_update_existing_skill_when_source_is_newer(self):
        old = time.time() - 100
        new = time.time()
        self.create_skill(
            self.gemini_root,
            "demo",
            "---\nname: demo\ndescription: old\n---\nold body\n",
            old,
        )
        self.create_skill(
            self.codex_root,
            "demo",
            "---\nname: demo\ndescription: new\n---\nnew body .codex/skills/demo\n",
            new,
        )

        report = self.module.sync_skill_trees(
            [self.claude_root, self.codex_root],
            self.gemini_root,
            dry_run=False,
        )

        self.assertEqual(report["updated"], ["demo"])
        updated = (self.gemini_root / "demo" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("description: new", updated)
        self.assertIn(".gemini/skills/demo", updated)

    def test_skip_when_gemini_is_newer(self):
        old = time.time() - 100
        new = time.time()
        self.create_skill(
            self.gemini_root,
            "demo",
            "---\nname: demo\ndescription: gemini\n---\nkeep me\n",
            new,
        )
        self.create_skill(
            self.claude_root,
            "demo",
            "---\nname: demo\ndescription: claude\n---\nreplace me\n",
            old,
        )

        report = self.module.sync_skill_trees(
            [self.claude_root, self.codex_root],
            self.gemini_root,
            dry_run=False,
        )

        self.assertIn("demo", report["skipped"])
        current = (self.gemini_root / "demo" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("description: gemini", current)

    def test_pick_newest_source_when_both_agents_have_same_skill(self):
        older = time.time() - 200
        newer = time.time()
        self.create_skill(
            self.claude_root,
            "demo",
            "---\nname: demo\ndescription: older\n---\nolder\n",
            older,
        )
        self.create_skill(
            self.codex_root,
            "demo",
            "---\nname: demo\ndescription: newer\n---\nnewer\n",
            newer,
        )

        report = self.module.sync_skill_trees(
            [self.claude_root, self.codex_root],
            self.gemini_root,
            dry_run=False,
        )

        self.assertEqual(report["copied"], ["demo"])
        current = (self.gemini_root / "demo" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("description: newer", current)

    def test_dry_run_reports_without_writing(self):
        now = time.time()
        self.create_skill(
            self.claude_root,
            "demo",
            "---\nname: demo\ndescription: demo\n---\nbody\n",
            now,
        )

        report = self.module.sync_skill_trees(
            [self.claude_root, self.codex_root],
            self.gemini_root,
            dry_run=True,
        )

        self.assertEqual(report["copied"], ["demo"])
        self.assertFalse((self.gemini_root / "demo").exists())


if __name__ == "__main__":
    unittest.main()
