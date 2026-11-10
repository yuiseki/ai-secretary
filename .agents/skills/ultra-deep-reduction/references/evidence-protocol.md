# Investigation and evidence protocol

## Preserve evidence types

Label decisive statements as:

- **OBSERVED:** dated primary source, instrumented measure, configuration,
  contract, interview attribution, ticket or audit result. Include scope and
  limitations (e.g. logs only retained 30 days).
- **INFERRED:** explicit explanation derived from observations; name rival
  explanations and possible disconfirming evidence.
- **HYPOTHESIZED:** a plausible structural cause or improvement needing a test.
- **UNKNOWN:** missing access, truncated time period, contradictory owners,
  untested dependencies, absent data or non-visible users.

A good report never converts UNKNOWN to "none" by convenience. Be especially
careful with telemetry that was never enabled or does not observe a type of use.

## Work from topological structure, not indiscriminate enumeration

1. Enumerate the **kinds** of artifacts and decision domains.
2. Identify protected classes (security logging, backups, account recovery,
   compliance retention, production core, customer-facing capability).
3. Group by purpose, policies, owner, environment, and dependencies.
4. Inspect a stratified sample of ordinary instances across groups, and a
   purposeful sample of unusual/high-risk instances; document selection bias.
5. Check exceptions and edge cases; expand only when samples reveal inconsistent
   patterns or a material decision depends on complete coverage.
6. For an actionable removal plan, perform a complete per-target dependency and
   obligation assessment. Sampling alone cannot certify a particular resource
   for deletion.

Avoid claiming "all items" when only visible accounts, regions, services, or
permissions were queried.

## A minimum decision task trial

Use 2–4 concrete tasks, preferably drawn from actual recent work; a trial is
optional if sufficient historical work traces exist. Example:

- Locate owner and documented purpose for a chosen resource.
- Find all required approvals for a non-destructive access change.
- Identify the responder and dependency graph for a simulated incident.
- Decide whether a dormant resource can be retired, including evidence trail.

For each: task ID, sampling method, participant/role (only if appropriate and
consented), tools available, time, number of handoffs, ambiguity encountered,
errors, and whether the task was completed. Distinguish subjective frustration
from observed delays while treating both as relevant signals. Avoid surveillance
of individuals or collecting private activity logs without authorization.

Compare candidate alternatives with the *same* task definition and context;
call out learning effects and missing counterfactual evidence. Do not infer
population-wide productivity gains from a few anecdotes.

## Reconstruction of the original requirement

| Question | Acceptable answers |
|---|---|
| Who asked for it? | Name or traceable role + dated decision, or UNKNOWN |
| Who owns it now? | Current accountable person or authorized role, or UNKNOWN |
| What did it prevent? | Concrete failure mode / boundary / promised outcome |
| Why is it still required? | Current evidence, law, contract, user benefit, or explicitly uncertain |
| What changes if removed? | Operational, safety, legal, financial, human consequences |
| Who may approve modification? | Actual delegated authority, not presumed creator |

A named requirement author does not have veto power unless governance grants it.
Unknown author is a governance finding, not a permission to bypass controls.

## Kinds of value to look for

- Direct: current outputs and beneficiaries.
- Enabling: dependencies and shared foundations in other systems.
- Protective: logging, backup, recovery, segregation, security, privacy, audit,
  accessibility, including rare-event use.
- Future: funded commitments, credible foreseeable need, recreation difficulty.

## Comparing alternatives

Compare the status quo and each alternative on: outcomes and controls kept or
lost; human decision surface added or removed; operational and security risk,
including blast radius; future running cost and effort; one-off migration cost,
unknown dependencies, residual duties and reversibility; and people absent from
interviews. Keep these separate rather than combining them into one score.

## Time horizon and future value

Match the horizon to the purpose: daily operations, annual financial processes,
retention obligations, infrequent disasters, renewal cycles, and planned launches.
Historical non-use is weaker evidence for a backup than for a session-based tool.

Use comparable future scenarios:

- Status quo: current carrying and decision costs continue.
- Structural reduction: fewer rules/variations, protected resources unchanged.
- Consolidation: reduced surfaces, added migration and concentration risk.
- Archive or freeze: value preserved with ongoing residual duties.
- Freeze and observe: a time-boxed reversible freeze that generates the
  missing usage evidence before any retirement decision.
- Retirement: avoided carrying burden and capability permanently/temporarily lost.

What is *already spent* is sunk; what must still be paid, protected, migrated,
recreated or explained is not. Avoid treating possible future use as automatically
infinite option value: ask for credible commitments, scenarios, and recreation
cost. Also avoid pretending the future can be proven valueless forever.

## Risk and proof gates

Before labeling RETIRE (PROPOSED), obtain evidence that:

- The target and owner/decision authority are identified.
- Direct, enabling, protective and prospective value were investigated.
- Downstream dependencies and affected people were investigated with sufficient
  coverage for the actual target.
- Records, privacy, contracts, permissions, recovery and closure obligations
  have a path acceptable to accountable owners.
- The expected management-surface reduction is articulated.
- Where usage evidence was weak, a freeze-and-observe window matched to the use
  cycle has passed without credible reaction, and its coverage is stated (see
  [freeze and observe before rm](freeze-and-observe.md)).
- A staged human execution plan could define checkpoints, abort criteria and
  irreversible boundaries (even if this skill does not implement one).

If these gates are not met, use INVESTIGATE, BLOCKED, FREEZE (as proposal only),
FREEZE AND OBSERVE (as proposal only),
or RETAIN. No confidence label alone bypasses gates.

## Evidence register: small record format

```text
claim_id: C-07
statement: "Seven observed teams each maintain separate on-call escalation maps"
status: OBSERVED | INFERRED | HYPOTHESIZED | UNKNOWN
source: specific source / person / artifact
observed_at: YYYY-MM-DD
coverage: 7 of 10 known teams; 3 unknown
alternative_explanation: teams require different legal/security boundaries
falsification: compare actual on-call obligations and escalation outcomes
impact_on_decision: supports investigation; insufficient for consolidation
```

Keep an evidence register only when claims cannot be traced reliably inline.
Prefer existing issue/ticket artifacts; don't create a separate database merely
to store this exercise.
