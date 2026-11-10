---
name: ultra-deep-reduction
description: >-
  Portfolio-first reduction of accumulated technical and organizational complexity.
  Use when cloud accounts, S3 buckets, GitHub repositories, Slack channels,
  agent skills, services, SaaS apps, jobs, permissions, policies, dashboards,
  documents, or AI-generated artifacts have proliferated. Investigates cognitive
  load, invisible coordination costs, exceptions, ownership, actual and latent
  value, and safe reduction alternatives. Produces evidence-based proposals for
  human decision; never changes live systems.
argument-hint: "[aws|github.com/<owner>|slack|skills|other] [scope]"
metadata:
  version: "3.3.0"
---

# ultra-deep-reduction

The goal is to reduce what people must carry in their heads: the independent
facts, distinctions, decisions, exceptions, dependencies and responsibilities
needed to operate a system safely. It is **not** to delete as many objects as
possible. Forty accounts, a thousand repositories or more Slack channels than
employees may be harmful even if every item works and costs little, or may be
exactly right. **Count is a trigger for investigation, not a verdict.**
Like AIC or Bayesian model evidence, every distinction must buy more accuracy
than the complexity it costs; see [the Bayesian reading](references/bayesian-view.md).

## Rules

1. **Advise, never act.** Do not delete, close, stop, merge, revoke, archive,
   rename, freeze, or change settings, permissions or telemetry. A requested
   local report is fine. Execution is a separate, expressly authorized task.
2. **Observe within permission, minimally.** Prefer existing inventories, IaC,
   logs and read-only APIs. Do not read or export contents (objects, messages,
   transcripts) or personal data unless authorized for that purpose.
3. **Invisible is not unused.** No traffic, no owner, no bill or no logs is
   UNKNOWN, never zero.
4. **Protect hard constraints.** Security, logging, backup, recovery, audit,
   legal retention, contracts, safety, accessibility and isolation can justify
   idle or duplicate things.
5. **No quotas, no composite scores, no invented dollar values**, and no AIC or
   evidence values unless computed from real data.
6. **No blame.** Judge artifacts and incentives, not people or whether AI made them.
7. **Do not add more machinery than you remove.** No new CMDB, dashboard,
   scanner, committee or meta-skill unless a simpler change cannot do the job.
   Bound the investigation itself.

## Procedure

0. **Frame.** Name the human pain and the one decision this work should
   improve. Start from a small representative scope plus high-risk outliers.
1. **Question distinctions.** For each kind of boundary, ask what failure it
   prevents, who requires it and who may change it. Often the fix is fewer
   rules, not fewer objects.
2. **Find the burden.** Look at real work: finding, telling apart, deciding,
   coordinating, recovering, keeping current. Prefer a small task trial.
   See [complexity model](references/complexity-model.md).
3. **Group into families** by purpose, policy, owner and dependency; inspect a
   sample of each plus every unusual or critical member.
4. **Test value fairly:** direct, enabling, protective, rare-event and future.
   Label claims OBSERVED / INFERRED / HYPOTHESIZED / UNKNOWN.
   See [evidence protocol](references/evidence-protocol.md).
5. **Remove before improving:** remove the obligation, then reduce boundaries,
   then reduce variation, then reduce exposure; or retain explicitly. Automate
   last, if at all.
6. **Freeze and observe before rm.** When usage evidence is weak and nothing
   protective is at stake, propose a reversible freeze with a signpost, an
   observation window matching the use cycle, and an end date, before any
   deletion. Never for backups, logs, audit or recovery.
   See [freeze and observe](references/freeze-and-observe.md).
7. **Try to disprove your proposal**, especially around security, recovery,
   identity, external integrations and rare paths. If a safeguard is uncertain,
   the answer is BLOCKED.
8. **Stop at a human decision** with one disposition per item:

| Disposition | Meaning |
|---|---|
| RETAIN | Distinction and burden are justified |
| REDUCE VARIATION | Keep instances, remove divergent handling |
| CONSOLIDATE | Fewer boundaries, after isolation checks |
| FREEZE / ARCHIVE | Keep option value with less active burden |
| FREEZE AND OBSERVE (PROPOSED) | Time-boxed reversible freeze before any retirement |
| RETIRE (PROPOSED) | Removal, as a separate authorized change |
| INVESTIGATE | Name the single observation that decides next |
| BLOCKED | A duty, unknown or safety dependency prevents action |

## Output

A short decision brief using [the template](assets/decision-brief.md): one
sentence on why the portfolio is hard, the boundaries to keep, the observed
burden, at most three structural hypotheses, the decision queue, one next
falsifiable step, and what knowledge or rules would disappear versus what new
obligations appear. Report the investigation's own cost.

## Target and domain playbook

Arguments: `$ARGUMENTS`

The first word picks the portfolio, either as a keyword or as a URL-like
target that also names the scope; the rest narrows the scope. Read only the
matching playbook:

| First word | Example | Playbook |
|---|---|---|
| `aws`, `s3`, `s3://…`, an account ID | `s3://bucket-prefix` | [AWS accounts and S3](references/aws-portfolio.md) |
| `github`, `repos`, `github.com/<owner>` | `github.com/yuiseki` | [GitHub repositories](references/github-portfolio.md) |
| `slack`, `chat`, `teams`, `discord`, `<ws>.slack.com` | `slack #proj-*` | [Slack and chat channels](references/slack-portfolio.md) |
| `skills`, `agent-skills`, a skills directory | `skills .agents/skills` | [Agent skills](references/agent-skills-portfolio.md) |
| `other`, `saas`, `data`, `ops`, `policy` | `saas` | [Other domains](references/other-domains.md) |

A bare keyword often leaves the owner unclear: `github` alone could mean a
personal account or any of several organizations, each with hundreds of
repositories. If the scope is not named, ask for it (for example
`github.com/<owner>`) before investigating. If the arguments are empty,
unrecognized, or the placeholder above was not substituted, infer the portfolio
from the request; if still unclear, ask. Test cases: [evals/README.md](evals/README.md).

## Before answering

- Did I reduce what people must know, or only count objects?
- Did I treat rare-but-critical use or missing telemetry as zero?
- Does my proposal add more machinery than it removes?
- Is the next step small, authorized and non-destructive?
