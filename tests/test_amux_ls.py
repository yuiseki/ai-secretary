import contextlib
import importlib.machinery
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "amux"
LOADER = importlib.machinery.SourceFileLoader("amux", str(SCRIPT))
SPEC = importlib.util.spec_from_file_location("amux", SCRIPT, loader=LOADER)
amux = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(amux)


class StatusIconTests(unittest.TestCase):
    def test_each_state_has_its_own_icon(self):
        states = ("run", "wait", "idle", "dead", "-")
        icons = [amux.status_icon(state) for state in states]
        self.assertEqual(icons, ["◐", "◔", "○", "×", "·"])

    def test_unknown_state_falls_back_to_dot(self):
        self.assertEqual(amux.status_icon("something"), "·")


class ListIconTests(unittest.TestCase):
    def listing(self, show_all=False):
        entries = [
            ("busy", "claude", "up"),
            ("free", "codex", "up"),
            ("gone", "claude", "up"),
            ("left", "claude", "up"),
        ]
        live = {"busy": True, "free": True, "gone": False}
        out = io.StringIO()

        with patch.object(amux, "read_state", return_value=entries), \
             patch.object(amux, "tmux_live", return_value=live), \
             patch.object(amux, "tmux_states", return_value={"busy": "run"}), \
             patch.object(amux, "COLOR", False), \
             contextlib.redirect_stdout(out):
            amux.list_names(show_all=show_all, detail=False)

        return out.getvalue().splitlines()

    def test_rows_start_with_the_state_icon(self):
        rows = self.listing()
        self.assertEqual([row.split()[0] for row in rows], ["◐", "○", "×"])
        self.assertEqual(rows[0].split()[1:], ["busy", "claude", "up", "run"])

    def test_down_rows_show_a_dot(self):
        rows = self.listing(show_all=True)
        self.assertEqual(rows[-1].split()[:2], ["·", "left"])


if __name__ == "__main__":
    unittest.main()
