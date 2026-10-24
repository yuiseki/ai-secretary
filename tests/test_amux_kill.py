import importlib.machinery
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import time
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "amux"
LOADER = importlib.machinery.SourceFileLoader("amux", str(SCRIPT))
SPEC = importlib.util.spec_from_file_location("amux", SCRIPT, loader=LOADER)
amux = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(amux)


def alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False

    # A zombie is dead for our purposes.
    stat = Path(f"/proc/{pid}/stat")
    return stat.exists() and stat.read_text().rsplit(")", 1)[1].split()[0] != "Z"


@unittest.skipUnless(shutil.which("tmux"), "tmux is required")
class KillTmuxTests(unittest.TestCase):
    NAME = "zz-amux-kill-test"

    def tearDown(self):
        subprocess.run(["tmux", "kill-session", "-t", f"={self.NAME}"],
                       capture_output=True)

    def test_kill_reaches_a_process_that_ignores_hangup(self):
        # opencode ignores SIGHUP, so tmux kill-session alone leaves it
        # running with no terminal.
        marker = f"zz-amux-kill-{os.getpid()}"
        subprocess.run(
            ["tmux", "new-session", "-d", "-s", self.NAME,
             f"bash -c 'trap \"\" HUP; exec -a {marker} sleep 300'"],
            check=True,
        )
        time.sleep(0.5)
        pids = [int(p) for p in subprocess.run(
            ["pgrep", "-f", marker], capture_output=True, text=True,
        ).stdout.split()]
        self.assertTrue(pids)

        amux.kill_tmux(self.NAME)

        self.assertFalse(any(alive(pid) for pid in pids))
        self.assertFalse(amux.tmux_exists(self.NAME))


if __name__ == "__main__":
    unittest.main()
