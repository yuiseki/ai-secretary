# Freeze and observe before rm

Deletion is the one step that usually cannot be taken back. Historical
telemetry can show that something was not used; it cannot show that nobody
**needs** it. Freeze-and-observe-before-rm closes that gap with a staged,
reversible experiment:

1. **Freeze:** make the target unusable in a way that can be undone quickly and
   completely (disable login, block access by policy, stop a schedule), while
   keeping the data, configuration and identity intact.
2. **Observe:** for a window that matches the target's real use cycle, watch
   for blocked attempts in logs, downstream failures, and human reactions such
   as "I can't log in, I was still using that!"
3. **Remove:** only if the target is still clearly unused after the window, and
   only through a separately approved deletion, propose RETIRE.

Any reaction during the window ends the experiment: unfreeze, record who needed
it and why, and reclassify the target. A scream is a successful observation,
not a failure of the plan.

This skill **designs and proposes** such a plan. The freeze itself changes a
live system, so it is a separately authorized change carried out by a human or
an expressly authorized task, never a step this skill performs.

## When to propose it

- The usage evidence is weak or UNKNOWN (no owner, telemetry never enabled,
  short log retention), and no protected duty is known.
- Deletion is irreversible or recreation is costly.
- The target has plausible but unidentified consumers: people, scripts,
  partners, other accounts or repositories.

## When not to propose it

- **Protective components** whose value lies in rare events: backups, disaster
  recovery, security logging, audit evidence, break-glass access, legal holds.
  Freezing these removes the protection for the whole window, and the window
  will almost never contain the rare event. Use RETAIN, INVESTIGATE or BLOCKED.
- **Write paths that would lose data:** blocking writes to a bucket that
  receives logs, replication or uploads drops whatever arrives during the
  window. The freeze would itself cause irreversible loss.
- **Safety, accessibility or public-interest services** where even a short
  outage harms people who cannot easily complain.
- When the evidence already suffices for a decision (see E12): freezing adds
  disruption without information. When the evidence clearly shows the target is
  needed, RETAIN.

## Designing the freeze

- **Reversibility must be tested, not assumed.** Write the unfreeze steps down,
  name who can run them, and state the expected restore time. Prefer freezes
  that keep everything in place: deny policies, disabled credentials, disabled
  sign-in, disabled workflows, archived (read-only) state.
- **Check the side effects of the freeze itself.** Lifecycle rules, expiry,
  retention clocks, rotations, billing or license deprovisioning may continue or
  trigger during the freeze. A freeze that silently starts a deletion clock is
  not a freeze.
- **Freeze in stages.** Start with one representative member of a family or a
  narrow scope, then widen. Do not freeze hundreds of targets at once.
- **Leave a signpost at the point of failure.** A deny message, README banner,
  description or login notice that says what happened and whom to contact.
  Without it, a person who needs the target may give up silently, and silence
  will be misread as non-use.
- **Announce where appropriate.** Advance notice in the channels likely
  consumers read turns some screams into early replies. Decide case by case
  whether announcement or a quiet freeze gives better evidence, and record why.

## Designing the observation

- **Window length follows the use cycle**, not a convenient number: monthly
  closing, quarterly reporting, annual tax or audit, biennial regulatory
  processes, academic terms, seasonal campaigns. If the cycle is longer than an
  acceptable freeze, say so and prefer FREEZE / ARCHIVE or INVESTIGATE.
- **Machines do not scream.** Scripts, scheduled jobs, partner integrations and
  other accounts fail quietly. Identify where their failures would appear
  (denied-access records, error rates, failed job runs, partner support tickets)
  before freezing, and check those places during the window.
- **People who are absent cannot scream:** leave, rotation, annual users,
  external collaborators. Note who would not notice within the window.
- **Use observation that already exists.** Enabling new logging (for example
  data-access logs) can cost money and is itself a configuration change needing
  approval; propose it explicitly rather than assuming it.
- **Record every signal** with date, source and outcome, including "no signal
  observed" with the coverage that statement actually has.

## Stop conditions during the window

- Any credible report of need, any unexplained denied access from a known or
  unknown principal, or any downstream failure traced to the freeze: unfreeze
  first, investigate second.
- The unfreeze does not restore the previous state within the promised time:
  stop the programme and treat it as an incident in the plan itself.
- A protected duty is discovered (retention, audit, recovery): BLOCKED.

## After the window

- **Silence is evidence over the window and coverage observed, not proof.**
  Report it as OBSERVED with that scope. The RETIRE proof gates in the
  [evidence protocol](evidence-protocol.md) still apply.
- Consider preserving a minimal, license- and privacy-compatible export before
  deletion when recreation would be impossible and keeping it is cheap.
- Deletion is a new, separately approved change with its own decision-maker.
- **Do not let frozen things accumulate.** Each frozen target is itself a new
  exception (a deny policy, a disabled account, a banner) that people must
  understand. Every freeze needs an end date and an owner who will either
  unfreeze or propose removal. A portfolio full of indefinitely frozen items has
  moved the burden, not reduced it.

## Plan record

```text
target: <family or asset, scope>
reason: weak/UNKNOWN usage evidence; no protected duty found (sources)
freeze action: <reversible action>, side effects checked: <list>
unfreeze action: <steps>, owner: <person>, restore time: <estimate, tested?>
signpost: <message and contact at the point of failure>
announcement: <channels or "quiet", with reason>
observation: <log sources, failure locations, human channels>
window: <length> because <use cycle>
not covered: <absent people, machine paths without logs>
stop conditions: <list>
end date: <date>, then: unfreeze or propose RETIRE (separate approval)
approver: <person>
```

## Domain examples (all proposals, not actions)

- **AWS accounts:** remove SSO/permission-set assignments or apply a deny-all
  SCP to a non-management member account, rather than closing it. Confirm
  break-glass and security tooling access remain, and that the account is not a
  logging, audit or backup boundary.
- **S3 buckets:** a bucket policy denying reads (and only where safe, writes)
  rather than deleting objects or the bucket. Check that lifecycle expiry,
  replication and inbound log delivery are not affected in a way that loses data.
- **IAM users and keys:** deactivate access keys and console login instead of
  deleting the principal.
- **GitHub repositories:** archive (read-only, reversible by unarchiving) or
  disable specific workflows rather than deleting. Making a public repository
  private is a poor freeze: it drops stars and watchers and hides published
  URLs, so outsiders cannot scream through the usual channels. See the
  [GitHub playbook](github-portfolio.md).
- **SaaS seats and apps:** suspend the user or unassign the SSO app instead of
  deleting the tenant or account; check whether suspension deprovisions data.
- **Slack channels:** archive (history kept, can be unarchived) after a notice
  naming the successor channel and a contact; check webhooks and apps that post
  to it first. For chat, archive is often the end state rather than a step
  before deletion. See the [Slack playbook](slack-portfolio.md).
- **Agent skills:** move the skill out of the directories agents load, keeping
  the files; check sync tools that could restore it and instruction files that
  name it. Agents improvise instead of complaining, so decide in advance where
  a missing skill would show. See the [Agent Skills playbook](agent-skills-portfolio.md).
- **Scheduled jobs and pipelines:** disable the schedule while keeping the
  definition, and watch the consumers of its outputs.
