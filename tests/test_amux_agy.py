import contextlib
import importlib.machinery
import importlib.util
import io
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "amux"
LOADER = importlib.machinery.SourceFileLoader("amux", str(SCRIPT))
SPEC = importlib.util.spec_from_file_location("amux", SCRIPT, loader=LOADER)
amux = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(amux)

RULE = "─" * 78
MODEL = "Gemini 3.8 Flash · high"


def idle_footer(tasks: str = "") -> str:
    return f"? for shortcuts{' ' * 40}{MODEL}{tasks}"


def busy_footer(tasks: str = "") -> str:
    return f"esc to cancel{' ' * 43}{MODEL}{tasks}"


# Screens below were captured from agy 1.3.5 in tmux, blank lines
# dropped the way tmux_states drops them.
IDLE = [
    "  コマンドを実行いたしました。完了まで少々お待ちくださいませ。",
    "  完了いたしました。",
    RULE,
    ">",
    RULE,
    idle_footer(),
]

GENERATING = [
    "> leep 25 を実行する bash",
    "  コマンドを走らせてから、完了したと一言だけ答えてください。",
    "⣽  Generating...",
    RULE,
    ">",
    RULE,
    busy_footer(),
]

RUNNING_COMMAND_WITH_TASK = [
    "● Running (if command -v leep >/dev/null 2>&1; then le...) (ctrl+o to expand)",
    "⢿  Running command...",
    "└ Tip: Press ctrl+o to expand or collapse tool details.",
    RULE,
    ">",
    RULE,
    "  ● [16:10:23] if command -v leep >/dev/null 2>&1; then leep 25; el... running",
    RULE,
    busy_footer(" · 1 task(s) · /tasks"),
]

TASK_AFTER_TURN = [
    "  コマンドを実行いたしました。完了まで少々お待ちくださいませ。",
    RULE,
    ">",
    RULE,
    "  ● [16:10:23] if command -v leep >/dev/null 2>&1; then leep 25; el... running",
    RULE,
    idle_footer(" · 1 task(s) · /tasks"),
]

PERMISSION = [
    "Command",
    RULE,
    "Requesting permission for:",
    "   if command -v leep >/dev/null 2>&1; then leep 25; else sleep 25; fi",
    "Run this command?",
    "> 1. Yes, run command",
    "  2. No, cancel",
    "  ↑/↓ Navigate · tab Amend · ctrl+g edit/expand command",
    busy_footer(),
]

SLASH_POPUP = [
    "  完了いたしました。",
    RULE,
    "> /ren",
    RULE,
    "> /rename          Rename the current conversation",
    "  /rewind          Rewind conversation to a previous message",
    "  ↑/↓ Navigate · enter Select · tab Complete",
    busy_footer(),
]

TRUST = [
    "Accessing workspace:",
    "/home/yuiseki/Workspaces",
    "Do you trust the contents of this project?",
    "Antigravity CLI requires permission to read, edit, and execute files here.",
    "> Yes, I trust this folder",
    "  No, exit",
    "  ↑/↓ Navigate · enter Confirm",
    f"{' ' * 55}{MODEL}",
]


class AgyStateTests(unittest.TestCase):
    def test_idle_footer_is_idle(self):
        self.assertEqual(amux.state_agy(IDLE), "idle")

    def test_spinner_above_the_composer_is_run(self):
        self.assertEqual(amux.state_agy(GENERATING), "run")

    def test_run_wins_over_a_background_task(self):
        self.assertEqual(amux.state_agy(RUNNING_COMMAND_WITH_TASK), "run")

    def test_task_left_after_the_turn_is_wait(self):
        self.assertEqual(amux.state_agy(TASK_AFTER_TURN), "wait")

    def test_permission_prompt_is_wait(self):
        # Its footer says "esc to cancel" too, but a person is needed.
        self.assertEqual(amux.state_agy(PERMISSION), "wait")

    def test_slash_popup_is_idle(self):
        # The popup puts "esc to cancel" in the footer with nothing
        # working behind it.
        self.assertEqual(amux.state_agy(SLASH_POPUP), "idle")

    def test_trust_dialog_is_wait(self):
        self.assertEqual(amux.state_agy(TRUST), "wait")

    def test_transcript_mentions_are_ignored(self):
        lines = [
            "  Requesting permission for: is what the dialog says",
            "  Do you trust the contents of this project? is a question",
            "⠋  and this line only looks like a spinner",
            *IDLE,
        ]
        self.assertEqual(amux.state_agy(lines), "idle")

    def test_task_count_in_the_transcript_is_ignored(self):
        lines = ["  it said 1 task(s) · /tasks once", *IDLE]
        self.assertEqual(amux.state_agy(lines), "idle")

    def test_many_task_rows_do_not_hide_the_spinner(self):
        tasks = [f"  ● [16:10:{n:02d}] job {n} running" for n in range(6)]
        lines = [
            "⢿  Running command...",
            RULE,
            ">",
            RULE,
            *tasks,
            RULE,
            busy_footer(" · 6 task(s) · /tasks"),
        ]
        self.assertEqual(amux.state_agy(lines), "run")

    def test_empty_screen_is_idle(self):
        self.assertEqual(amux.state_agy([]), "idle")


def make_summaries(path: Path, rows):
    db = sqlite3.connect(path)
    db.execute(
        "CREATE TABLE conversation_summaries ("
        "conversation_id text PRIMARY KEY, title text NOT NULL DEFAULT '',"
        " last_modified_time datetime NOT NULL)"
    )
    db.executemany(
        "INSERT INTO conversation_summaries VALUES (?, ?, ?)", rows
    )
    db.commit()
    db.close()


class FindAgyTests(unittest.TestCase):
    def find(self, rows, name="build"):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "conversation_summaries.db"
            make_summaries(db, rows)

            with patch.object(amux, "AGY_SUMMARIES", db):
                return amux.find_agy(name, {})

    def test_returns_the_conversation_id_for_the_title(self):
        rows = [("c1", "build", "2026-10-14 01:00:00"), ("c2", "other", "2026-10-14 02:00:00")]
        self.assertEqual(self.find(rows), "c1")

    def test_prefers_the_most_recently_modified(self):
        rows = [
            ("old", "build", "2026-10-13 01:00:00"),
            ("new", "build", "2026-10-14 01:00:00"),
        ]
        self.assertEqual(self.find(rows), "new")

    def test_unknown_title_is_none(self):
        self.assertIsNone(self.find([("c1", "other", "2026-10-14 01:00:00")]))

    def test_untitled_conversations_never_match_an_empty_name(self):
        self.assertIsNone(self.find([("c1", "", "2026-10-14 01:00:00")], name=""))

    def test_missing_database_is_none(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(amux, "AGY_SUMMARIES", Path(tmp) / "none.db"):
                self.assertIsNone(amux.find_agy("build", {}))


class AgyCommandTests(unittest.TestCase):
    def test_new_starts_in_auto_mode(self):
        self.assertEqual(amux.AGENTS["agy"]["new"]("build"), "agy --mode auto")

    def test_resume_uses_the_conversation_id(self):
        command = amux.AGENTS["agy"]["resume"]("build", "c-42")
        self.assertEqual(command, "agy --mode auto --conversation c-42")

    def test_kind_flag_is_accepted(self):
        self.assertEqual(amux.KIND_FLAGS["--agy"], "agy")


class AfterStartAgyTests(unittest.TestCase):
    def run_after_start(self, panes, resumed=False):
        sent = []
        screens = iter(panes)
        last = [panes[-1]]

        def capture(name):
            last[0] = next(screens, last[0])
            return last[0]

        with patch.object(amux, "capture_pane", side_effect=capture), \
             patch.object(amux, "send_keys", side_effect=lambda n, *k, **kw: sent.append(k)), \
             patch.object(amux.time, "sleep"), \
             patch.object(amux, "AGY_READY_TIMEOUT", 0.2), \
             contextlib.redirect_stdout(io.StringIO()):
            ok = amux.after_start_agy("build", resumed=resumed)

        return ok, sent

    COMPOSER = "\n".join(IDLE)

    TYPED = COMPOSER + "\n> /rename build"
    RENAMED = COMPOSER + "\n  ⎿  Conversation renamed to: build"

    def test_fresh_session_is_renamed_once_the_composer_is_up(self):
        ok, sent = self.run_after_start([self.COMPOSER, self.TYPED, self.RENAMED])
        self.assertTrue(ok)
        self.assertEqual(sent.count(("/rename build",)), 1)
        self.assertIn(("Enter",), sent)

    def test_keys_typed_before_the_composer_listens_are_retyped(self):
        # agy draws its footer a moment before it reads the keyboard, so
        # the first attempt can vanish without a trace.
        ok, sent = self.run_after_start(
            [self.COMPOSER, self.COMPOSER, self.TYPED, self.RENAMED]
        )
        self.assertTrue(ok)
        self.assertEqual(sent.count(("/rename build",)), 2)
        # Cleared before retyping, so a late arrival is not doubled.
        self.assertIn(("C-u",), sent)

    def test_rename_is_retried_until_the_conversation_exists(self):
        # Just after start the footer is up but there is no conversation
        # yet, and /rename answers "no active conversation".
        refused = self.TYPED + "\n  ⎿  Error: Failed to rename conversation: no active conversation"
        ok, sent = self.run_after_start(
            [self.COMPOSER, self.TYPED] + [refused] * 6 + [self.TYPED, self.RENAMED]
        )
        self.assertTrue(ok)
        self.assertEqual(sent.count(("Enter",)), 2)

    def test_gives_up_when_the_text_never_lands(self):
        ok, sent = self.run_after_start([self.COMPOSER])
        self.assertFalse(ok)
        self.assertNotIn(("Enter",), sent)

    def test_resumed_session_is_not_renamed(self):
        ok, sent = self.run_after_start([self.COMPOSER], resumed=True)
        self.assertTrue(ok)
        self.assertEqual(sent, [])

    def test_trust_dialog_is_not_answered_for_the_user(self):
        trust = "\n".join(TRUST)
        ok, sent = self.run_after_start([trust])
        self.assertFalse(ok)
        self.assertEqual(sent, [])


if __name__ == "__main__":
    unittest.main()
