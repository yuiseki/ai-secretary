# Agent Skills portfolio playbook: hundreds of skills

This is a **portfolio diagnosis**, not an instruction to delete, move, rename,
merge, disable or rewrite skills, or to change agent configuration, hooks,
scheduled jobs or sync tools. Apply to skill directories the user is authorized
to inspect: user-level, project-level and plugin-provided skills for any coding
agent (Claude Code, Codex, Gemini CLI and others that load `SKILL.md` folders).

Skills are cheap to create, especially by agents themselves, so they accumulate
quickly. Their count matters less than two questions: what must the **agent**
distinguish on every task, and what must the **human** remember to keep the
skills true?

## Why skills are a distinct case

- **Every skill is paid for on every session.** Names and descriptions are
  usually loaded into the agent's context so it can decide when to use them.
  The listing costs tokens and, more importantly, is a choice the model makes
  repeatedly. Overlapping descriptions cause wrong or missed triggers. This is
  distinction burden moved onto the agent, and from there onto the human who
  has to notice and correct it.
- **Missing skills fail silently.** When a needed skill is absent or not
  triggered, the agent improvises something plausible instead of reporting an
  error. Nobody screams; the work is just quietly worse or unsafe.
- **Stale skills are worse than none.** A skill describing a tool, path, API,
  device or workflow that has changed gives confident wrong instructions.
  Documentation accumulation applies with extra force, because the reader acts
  on it automatically.
- **Skills are referenced by name** from other skills, `CLAUDE.md`/`AGENTS.md`
  and similar instruction files, hooks, scheduled jobs and loops, routines,
  eval harnesses, sync scripts and the human's own habits (`/name`).
- **Skills encode hard-won knowledge and guardrails.** Gotchas from incidents,
  safety rules for destructive operations, hardware procedures and recovery
  runbooks are valuable precisely because they are used rarely.
- **Skills can run code.** Bundled scripts, third-party or plugin skills, and
  instructions involving credentials are a security surface. Fewer, reviewed
  skills reduce it.
- **Copies drift.** The same skill may exist in several places (per-agent
  directories, a shared directory, plugin caches, other machines) kept in step
  by a sync tool or by hand.

## Stage A: explain why the count exists

Enumerate **kinds**, not rows. Typical families:

- Writing and communication style; language-specific writing rules.
- Domain knowledge for a project, library or dataset.
- Operations runbooks: devices, servers, clusters, reboot and recovery.
- Integrations with external services (mail, calendar, chat, notifications).
- Personal routines (daily reports, morning/night routines, shopping).
- Meta skills: creating, syncing, evaluating or managing other skills.
- Variants: several skills for nearly the same task, often successive attempts
  or per-agent copies; plugin skills that duplicate local ones.
- Retired subjects: skills for finished projects, replaced tools or devices no
  longer owned.

For each family identify: where it lives and where copies exist, which agents
load it, whether it is model-triggered or only user-invoked, whether it bundles
scripts or needs credentials, what references it by name, when it was last
changed, and who maintains it.

Read-only sources that usually suffice:

- The skill directories themselves: frontmatter, size, bundled files, git log.
- A text search for each skill name across instruction files, other skills,
  hooks, schedulers, loop/routine definitions and scripts.
- Agent session transcripts, used only for **counts** of explicit invocations
  (skill tool calls, slash commands, reads of `SKILL.md`). Transcripts hold
  private conversation; do not quote or summarize their contents. They are also
  pruned after a retention period, so the observable window can be short;
  state it.

## Stage B: diagnose the management surface

Ask the agent-and-human operational questions:

1. For a realistic request, does the agent pick the intended skill? Run a small
   routing trial: a handful of representative prompts per family, and record
   which skill (if any) was chosen. Repeated misroutes among look-alike
   descriptions are direct evidence of distinction burden.
2. How large is the always-loaded listing (characters or tokens of names plus
   descriptions), and how much of it is for skills that are rarely relevant?
3. Can the human say, for a given task, which skill should be used and whether
   it is current? How many near-duplicates must they keep in mind?
4. How many skills reference commands, paths, versions, endpoints or devices
   that no longer exist? Check a sample against reality.
5. When a tool or convention changes, how many skills must be updated to stay
   true, and in how many copies?
6. Which skills bundle executable scripts or ask for credentials, and who has
   reviewed them?

## Stage C: consider structural alternatives

**Alternative 1: remove the obligation.** Retire skills for finished projects,
replaced tools and devices no longer used, after reference checks. Their
knowledge may belong in the project's own repository (README, comments, tests)
instead of a global skill every session pays for.

**Alternative 2: merge overlapping skills, carefully.** Several skills for the
same task can become one with a clear description. Watch the trade-off: a merged
skill is larger, loads more text per trigger, and can blur distinct guardrails.
Prefer merging descriptions and routing first, bodies second.

**Alternative 3: reduce what is always loaded.** Where the agent supports it,
make rarely relevant skills user-invoked only, or move project-specific skills
to that project's directory so they load only there. This keeps the knowledge
while shrinking every session's decision surface.

**Alternative 4: reduce variation.** Consistent naming, frontmatter, and
description style (what it does, when to use it, when not to) make the listing
easier for both agent and human to scan. Collapse per-agent copies into one
source where the sync arrangement allows.

**Alternative 5: fix truth before scaling.** A stale skill is often better fixed
or removed than left to mislead; do not add new skills on top of ones known to
be wrong.

**Alternative 6: accept the shape.** Many small, sharply described, current
skills with distinct triggers can be fine. Say so.

Do not propose a new skill registry, catalog service, scheduled skill auditor
or meta-skill to manage the skills unless a simpler change cannot achieve the
same reduction. That would be one more skill to understand and keep true.

## Freeze and observe for skills

Apply [freeze and observe before rm](freeze-and-observe.md) with these
adjustments:

- **Freeze = take it out of the load path**, keeping the files (for example a
  directory the agents do not scan, or a disabled flag where supported). Git
  history makes many deletions recoverable, but untracked skills, local-only
  assets and secrets, and the knowledge that a skill once existed are not.
- **Check sync before freezing.** A sync tool or another copy can silently
  restore a frozen skill, or propagate the freeze to agents that still need it.
- **Agents do not scream; arrange for signals.** Before freezing, list where a
  missing skill would show: instruction files and other skills that name it,
  scheduled jobs and loops that invoke it, and tasks in its domain. During the
  window, watch for the human noticing "why didn't it use X?", misbehaviour in
  that domain, and failed invocations by name.
- **Window follows the use cycle:** monthly reports, annual tax, rare hardware
  maintenance, disaster recovery. A reboot or recovery runbook may be needed
  once a year and is protective; do not freeze it on inactivity.
- **Update the references** that name a frozen skill, or note the freeze there,
  so that instructions do not point at something absent.

## Two illustrative findings (hypothetical, not inferred from counts)

- Finding A: 120 skills; three writing-style skills for the same language with
  overlapping descriptions, and a routing trial shows the agent picks a
  different one for near-identical prompts. **Proposal:** decide which rules
  are distinct, merge descriptions so one skill owns the trigger, then propose
  freezing the others. **Not:** delete two of them by last-modified date.
- Finding B: a notification skill shows few explicit invocations, but the
  project instruction file tells the agent to use it whenever human input is
  needed. **Proposal:** RETAIN; it is a referenced foundation. **Not:** count
  invocations as its value.

## Stop conditions specific to skills

Mark BLOCKED when a proposed reduction might remove a safety guardrail for
destructive or irreversible operations, a recovery or hardware runbook, a skill
named by instruction files, hooks, schedulers or other skills whose users are
unknown, credential-handling instructions, or knowledge that exists nowhere
else. Deleting, moving, disabling, merging or rewriting skills, and changing
sync tools or agent configuration, are separate human-approved changes, not
steps within this skill.
