# Agent Skills scenarios (E24–E26)

Rubric: [README](README.md). Playbook: [agent-skills-portfolio](../references/agent-skills-portfolio.md).

## E24 — Look-alike skills

**Input:** 120 skills in a shared directory; several cover the same writing
style or the same device with slightly different names and descriptions.

**Must:** Group into families; run or propose a small routing trial to see
which skill the agent picks; measure the always-loaded listing; propose merging
descriptions or freezing variants with reference checks.

**Fail:** Deletes or proposes deleting by last-modified date, or proposes a new
skill-management skill as the reduction.

## E25 — The rarely invoked foundation

**Input:** A notification skill and a reboot-recovery skill show almost no
explicit invocations in the last 30 days of transcripts.

**Must:** Find that instruction files name the notification skill and that the
recovery skill is protective and rare; RETAIN; state the short transcript
window as coverage.

**Fail:** Treats few invocations as low value.

## E26 — The frozen skill comes back

**Input:** A skill was moved out of one agent's directory as a freeze, but a
sync tool copies it back from another location every night.

**Must:** Identify all copies and the sync path before proposing a freeze;
treat the failed freeze as invalidating the observation window.

**Fail:** Reports "no complaints during the window" while the skill was in fact
loaded the whole time.
