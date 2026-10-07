import importlib.util
import importlib.machinery
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace


SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "amux"
LOADER = importlib.machinery.SourceFileLoader("amux", str(SCRIPT))
SPEC = importlib.util.spec_from_file_location("amux", SCRIPT, loader=LOADER)
amux = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(amux)


class FindCodexTests(unittest.TestCase):
    def test_returns_thread_id_for_latest_matching_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            index = Path(tmp) / "session_index.jsonl"
            rows = [
                {"id": "thread-1", "thread_name": "build"},
                {"id": "thread-1", "thread_name": "renamed"},
                {"id": "thread-2", "thread_name": "build"},
            ]
            index.write_text("\n".join(json.dumps(row) for row in rows))

            with patch.object(amux, "CODEX_INDEX", index):
                self.assertEqual(amux.find_codex("build", {}), "thread-2")

    def test_ignores_malformed_and_incomplete_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            index = Path(tmp) / "session_index.jsonl"
            index.write_text(
                '{"thread_name":"build"}\n'
                'not json\n'
                '{"id":"thread-3","thread_name":"build"}\n'
            )

            with patch.object(amux, "CODEX_INDEX", index):
                self.assertEqual(amux.find_codex("build", {}), "thread-3")

    def test_returns_none_for_unknown_name_or_missing_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            index = Path(tmp) / "missing.jsonl"

            with patch.object(amux, "CODEX_INDEX", index):
                self.assertIsNone(amux.find_codex("build", {}))


class CodexResumeCommandTests(unittest.TestCase):
    def test_resume_uses_the_thread_id_from_the_index(self):
        command = amux.AGENTS["codex"]["resume"]("build", "thread-42")
        self.assertEqual(command, "codex resume thread-42")


class CodexStateTests(unittest.TestCase):
    def test_working_supports_seconds_minutes_and_hours(self):
        for elapsed in ("5s", "1m 05s", "1h 02m 03s"):
            with self.subTest(elapsed=elapsed):
                self.assertEqual(amux.state_codex([
                    f"• Working ({elapsed} • esc to interrupt)",
                    "› Ask Codex to do anything",
                ]), "run")

    def test_live_waiting_status_is_wait(self):
        for header in ("Waiting for background terminal · sleep 5",
                       "Waiting for agents", "Waiting for Robie [explorer]"):
            with self.subTest(header=header):
                self.assertEqual(amux.state_codex([
                    f"• {header} (1m 05s • esc to interrupt)",
                    "› Ask Codex to do anything",
                ]), "wait")

    def test_background_terminal_footer_is_wait(self):
        for count, plural in ((1, ""), (2, "s")):
            with self.subTest(count=count):
                self.assertEqual(amux.state_codex([
                    "› Ask Codex to do anything",
                    f"  {count} background terminal{plural} running · /ps to view · /clean to close",
                ]), "wait")

    def test_active_work_takes_precedence_over_background_terminal(self):
        self.assertEqual(amux.state_codex([
            "• Working (5s • esc to interrupt) · 1 background terminal running · /ps to view",
            "› Ask Codex to do anything",
        ]), "run")

    def test_tmux_capture_routes_codex_wait_state(self):
        result = SimpleNamespace(stdout=(
            "• Waiting for agents (2m 03s • esc to interrupt)\n"
            "\n› Ask Codex to do anything\n" + amux.CAPTURE_SEP + "\n"
        ))
        with patch.object(amux.subprocess, "run", return_value=result):
            self.assertEqual(amux.tmux_states([("build", "codex")]),
                             {"build": "wait"})

    def test_waiting_history_and_plain_text_are_idle(self):
        for lines in (
            ["• Waiting for agents", "› Ask Codex to do anything"],
            ["• Waiting for background terminal · sleep 5", "› Ask Codex to do anything"],
            ["No background terminals running.", "› Ask Codex to do anything"],
            ["• Waiting for agents (5s • esc to interrupt)"] + ["other text"] * amux.TAIL_LINES,
        ):
            with self.subTest(lines=lines):
                self.assertEqual(amux.state_codex(lines), "idle")


if __name__ == "__main__":
    unittest.main()
