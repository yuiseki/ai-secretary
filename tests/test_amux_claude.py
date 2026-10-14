import importlib.machinery
import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "amux"
LOADER = importlib.machinery.SourceFileLoader("amux", str(SCRIPT))
SPEC = importlib.util.spec_from_file_location("amux", SCRIPT, loader=LOADER)
amux = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(amux)

TOP = "─" * 60 + " od-geo ─"
BOTTOM = "─" * 70


def screen(*footer: str) -> list[str]:
    return [
        "✻ Baked for 40s · done 8:44 AM",
        TOP,
        "❯ ",
        BOTTOM,
        *footer,
    ]


class ClaudeStateTests(unittest.TestCase):
    def test_interrupt_footer_is_run(self):
        lines = screen("  ⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt")
        self.assertEqual(amux.state_claude(lines), "run")

    def test_shell_footer_is_wait(self):
        lines = screen("  ⏵⏵ auto mode on · 1 shell")
        self.assertEqual(amux.state_claude(lines), "wait")

    def test_monitor_footer_is_wait(self):
        lines = screen("  ⏵⏵ auto mode on · 1 monitor · ← 1 agent · ↓ to manage")
        self.assertEqual(amux.state_claude(lines), "wait")

    def test_shell_and_monitor_footer_is_wait(self):
        lines = screen("  ⏵⏵ auto mode on · 1 shell · 2 monitors")
        self.assertEqual(amux.state_claude(lines), "wait")

    def test_plain_footer_is_idle(self):
        lines = screen("  ⏵⏵ auto mode on (shift+tab to cycle)")
        self.assertEqual(amux.state_claude(lines), "idle")

    def test_agent_list_below_footer_is_read(self):
        # A background agent lists itself under the status line, so the
        # status line is no longer the last one on screen.
        lines = screen(
            "  ⏵⏵ auto mode on · 1 shell · ← 1 agent · ↓ to manage",
            "  ● main",
            "  ◯ general-purpose  Grepping repository   43m 24s · ↓ 132.5k tokens",
        )
        self.assertEqual(amux.state_claude(lines), "wait")

    def test_agent_count_alone_is_idle(self):
        # "<- 1 agent" is drawn by idle sessions too; it is not a count of
        # agents still running.
        lines = screen("  ⏵⏵ auto mode on (shift+tab to cycle) · ← 1 agent")
        self.assertEqual(amux.state_claude(lines), "idle")

    def test_interrupt_with_agent_list_is_run(self):
        lines = screen(
            "  ⏵⏵ auto mode on · esc to interrupt · ← 1 agent",
            "  ● main",
            "  ◯ general-purpose  Grepping   5s",
        )
        self.assertEqual(amux.state_claude(lines), "run")

    def test_new_task_hint_does_not_hide_a_running_shell(self):
        # A days-long rsync keeps "1 shell" up while claude offers a new
        # task; the rsync is the work, so the session is not free.
        lines = [
            "✻ Sautéed for 3m 6s · done 1:58 AM · 1 shell still running",
            "                    new task? /clear to save 598.6k tokens",
            TOP,
            "❯ ",
            BOTTOM,
            "  ⏵⏵ auto mode on · 1 shell · ← 1 agent · ↓ to manage",
        ]
        self.assertEqual(amux.state_claude(lines), "wait")

    def test_new_task_hint_without_shell_is_idle(self):
        lines = [
            "✻ Churned for 5m 57s · done 4:25 PM",
            "                    new task? /clear to save 701.7k tokens",
            TOP,
            "❯ ",
            BOTTOM,
            "  ⏵⏵ auto mode on (shift+tab to cycle) · ← 1 agent",
        ]
        self.assertEqual(amux.state_claude(lines), "idle")

    def test_new_task_in_transcript_is_ignored(self):
        lines = [
            "● the hint reads new task? /clear to save",
            "✻ Baked for 40s · done 8:44 AM · 1 shell still running",
            TOP,
            "❯ ",
            BOTTOM,
            "  ⏵⏵ auto mode on · 1 shell",
        ]
        self.assertEqual(amux.state_claude(lines), "wait")

    def test_transcript_mention_above_box_is_ignored(self):
        lines = [
            "● the footer says esc to interrupt and 1 shell",
            TOP,
            "❯ ",
            BOTTOM,
            "  ⏵⏵ auto mode on (shift+tab to cycle)",
        ]
        self.assertEqual(amux.state_claude(lines), "idle")

    def test_without_input_box_falls_back_to_last_line(self):
        self.assertEqual(amux.state_claude(["x", "esc to interrupt"]), "run")
        self.assertEqual(amux.state_claude([]), "idle")


PERMISSION = [' ▐▛███▛█   Claude Code v2.1.299', '▝▜██████▀  Sonnet 5.5 · Claude Team', ' ▝▝   ▝▝   /…/-Workspaces/4b3c36b7-28ed-4d01-8777-e0b500ad3057/scratchpad/askprobe', '❯ Run the bash command: date > out.txt . Do nothing else.', '● Writing current date to out.txt', '  ⎿  $ date > out.txt', '───────────────────────────────────────────────────────────────────────────────────────', ' Bash command', ' Tip: auto mode handles these prompts for you — choose "switch to auto mode" below', ' Write current date to out.txt', '╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌', ' date > out.txt', '╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌', ' Do you want to proceed?', ' ❯ 1. Yes', '   2. Yes, and always allow access to /tmp/claude-1000/-Workspaces/4b3c36b7-28ed-4d01-8', '      777-e0b500ad3057/scratchpad/askprobe from this project', '   3. Yes, and switch to auto mode · auto mode handles these prompts for you', '   4. No', ' Esc to cancel · Tab to amend']

TRUST = ['───────────────────────────────────────────────────────────────────────────────────────', ' Accessing workspace:', ' /tmp/claude-1000/-Workspaces/4b3c36b7-28ed-4d01-8777-e0b500ad3057/scratchpad/askprobe', ' Quick safety check: Is this a project you created or one you trust? (Like your own', ' code, a well-known open source project, or work from your team). If not, take a', " moment to review what's in this folder first.", " Claude Code'll be able to read, edit, and execute files here.", ' Security guide', ' ❯ No, exit', '   Yes, I trust this folder', ' Enter to confirm · Esc to cancel']


class ClaudeAskTests(unittest.TestCase):
    def test_permission_prompt_is_ask(self):
        self.assertEqual(amux.state_claude(PERMISSION), "ask")

    def test_folder_trust_dialog_is_ask(self):
        self.assertEqual(amux.state_claude(TRUST), "ask")

    def test_question_dialog_is_ask(self):
        lines = ["☐ Pick one", "❯ 1. A", "  2. B", " Enter to select · ↑/↓ to navigate · Esc to cancel"]
        self.assertEqual(amux.state_claude(lines), "ask")

    def test_icon_is_filled_diamond(self):
        self.assertEqual(amux.status_icon("ask"), "◆")


if __name__ == "__main__":
    unittest.main()
