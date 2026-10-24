import importlib.machinery
import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "amux"
LOADER = importlib.machinery.SourceFileLoader("amux", str(SCRIPT))
SPEC = importlib.util.spec_from_file_location("amux", SCRIPT, loader=LOADER)
amux = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(amux)

# Screens captured from opencode 2.0.32 (non-empty lines, as tmux_states
# hands them over).

IDLE = ['                                                                                                ▄', '                                                               █▀▀█ █▀▀█ █▀▀█ █▀▀▄ █▀▀▀ █▀▀█ █▀▀█ █▀▀█', '                                                               █  █ █  █ █▀▀▀ █  █ █    █  █ █  █ █▀▀▀', '                                                               ▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀', '                                                                      /update to install v2.1.4', '                                             ┃', '                                             ┃  Ask anything… "Fix broken tests"', '                                             ┃', '                                             ┃  Build auto · Qwen3.6-35B-A3B llama-server (Workspaces)', '                                             ╹▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀', '                                             /Workspaces:main                          shift+tab agents  ctrl+p commands', '  ⊙ 1 plugin failed /plugins                                                                                                                                2.0.32']

RUN = [' ⠇ New session                   +', '  ┃', '  ┃  Run the bash command: sleep 20 . Then say done.', '  ┃', '  ┃', '  ┃', '  ┃', '  ┃  Build auto · Qwen3.6-35B-A3B llama-server (Workspaces)', '  ╹▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀', '   ■■■■■⬝⬝⬝ esc interrupt                                                                                                        shift+tab agents  ctrl+p commands']

ASK = [' ⠏ New session                   ! Date command execution        +', '  ┃', '  ┃  Use bash to run: date. Nothing else.', '  ┃', '  ┃', '  ┃  ⠙ date', '  ┃', '     Press ctrl+b to move running work to the background', '  ┃', '  ┃  △ Permission required', '  ┃', '  ┃  $ date', '  ┃', '  ┃', '  ┃   Allow once   Always allow   Reject                                                        ctrl+f fullscreen  ⇆ select  enter confirm', '  ┃']

WAIT = [' ⠇ New session                     Date command execution        +', '     Build · Qwen3.6-35B-A3B · 2m 17s · 0.4 tok/s', '  ┃', '  ┃  Use bash to run: sleep 120', '  ┃', '  ┃', '  ┃  ⠦ sleep 120', '  ┃', '  ┃   Background', '  ┃', "     The sleep 120 command is running in the background. I'll be notified automatically when it completes in about 2 minutes.", '     Build · Qwen3.6-35B-A3B · 1m 35s · 0.8 tok/s', "     The sleep 120 command is still running in the background. There's nothing else pending, so I'll end here — I'll be resumed automatically", '     when the command finishes.', '     Build · Qwen3.6-35B-A3B · 2m 0s · 1.0 tok/s', '  ┃', '  ┃', '  ┃', '  ┃  Build · Qwen3.6-35B-A3B llama-server (Workspaces)', '  ╹▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀', '  /tmp/claude-1000/-Workspaces/4b3c36b7-28ed-4d01-8777-e0b500ad3057/scratchpad/ocprobe                ↓ 1 shell · 9.0K (14%)  ctrl+p commands']

DONE = ['   Sleep command execution       +', '  ┃', '  ┃  Run the bash command: sleep 20 . Then say done.', '  ┃', '  ┃', '  ┃  $ sleep 20', '  ┃', '  ┃  (no output)', '  ┃', '     done', '     Build · Qwen3.6-35B-A3B · 1m 58s · 0.3 tok/s', '  ┃', '  ┃', '  ┃', '  ┃  Build auto · Qwen3.6-35B-A3B llama-server (Workspaces)', '  ╹▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀', '  /Workspaces:main                                                                                                                    18.5K (28%)  ctrl+p commands']


class OpencodeStateTests(unittest.TestCase):
    def test_fresh_composer_is_idle(self):
        self.assertEqual(amux.state_opencode(IDLE), "idle")

    def test_finished_turn_is_idle(self):
        self.assertEqual(amux.state_opencode(DONE), "idle")

    def test_esc_interrupt_footer_is_run(self):
        self.assertEqual(amux.state_opencode(RUN), "run")

    def test_permission_prompt_is_ask(self):
        self.assertEqual(amux.state_opencode(ASK), "ask")

    def test_backgrounded_shell_after_turn_is_wait(self):
        self.assertEqual(amux.state_opencode(WAIT), "wait")

    def test_transcript_quoting_the_footer_is_not_state(self):
        lines = IDLE[:-1] + ["  the footer says esc interrupt, 1 shell", IDLE[-1]]
        self.assertEqual(amux.state_opencode(lines), "idle")

    def test_empty_pane_is_idle(self):
        self.assertEqual(amux.state_opencode([]), "idle")

    def test_session_id_is_stable_per_name(self):
        a = amux.opencode_session_id("x")
        self.assertEqual(a, amux.opencode_session_id("x"))
        self.assertNotEqual(a, amux.opencode_session_id("y"))
        self.assertTrue(a.startswith("ses_"))

    def test_registered(self):
        self.assertIn("opencode", amux.AGENTS)
        self.assertEqual(amux.KIND_FLAGS["--opencode"], "opencode")
