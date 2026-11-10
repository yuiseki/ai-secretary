# Complexity model: count the decisions, not the rows

## The primary object is a management surface

A resource can impose human burden without incurring meaningful spend or
receiving traffic. This is an operational model for investigation, **not** a
universally standardized or already-validated metric.

**Management surface** means all the information and action boundaries a person
must traverse to answer ordinary operational questions: which thing is this,
what is it for, who can approve access, what is safe to change, what depends on
it, who responds to failures, and what to do when a capability is retired.

It is the set of *distinct, independently reasoned obligations*, not merely the
set of deployable objects.

## Five separate dimensions

| Dimension | Observable question | Example evidence |
|---|---|---|
| Discovery friction | How long to find the correct thing, owner, and authoritative record? | Timed search task, ticket, on-call trace |
| Distinction burden | Which variants require different reasoning? | Policy classes, exception list, different runbooks |
| Decision burden | How long to decide a safe change or retirement? | Approval path, triage chronology, dependency check |
| Coordination burden | How many independent teams or handoffs are involved? | Recorded handoffs, escalation path, RACI |
| Latent burden | What unexpected work appears when incidents, audits, or transitions occur? | Incident exercises, restore test, audit evidence |

Add direct spend, engineering effort, risk, and lost opportunity as **separate**
dimensions. Do not silently combine them into a single cognitive score.

### Why raw counts mislead

- 1,000 buckets generated from 3 tested patterns under a shared policy might
  require 3 primary concepts plus a few exceptions.
- 100 manually created buckets with 60 undocumented access patterns can require
  more independent reasoning.
- 40 AWS accounts can be the correct security boundaries, while 40 bespoke
  provisioning and access-request procedures can be the actual avoidable burden.
- Conversely, a single giant account can obscure purpose, increase blast radius,
  and create more decision complexity despite its lower count.

Therefore compare **what a person has to do before and after**, not just
`count(before) - count(after)`.

## Cognitive cost types

1. **Standing burden:** attention to dashboards, documentation, reviews, alerts,
   policy exceptions, updates and renewals.
2. **Transaction burden:** repeated searches, approvals, change analysis,
   ownership lookups, onboarding and handoffs.
3. **Contingent burden:** latent failure, security investigation, audit,
   migration and emergency restoration complexity.
4. **Propagation burden:** additional change coordination and uncertainty
   imposed on other teams and future maintainers, not paid by the creator.

No incident does not mean no contingent burden. However, a possible scenario is
not an observed cost: note its likelihood, severity, and evidentiary basis.

## Guard against false optimization

- **Cosmetic grouping:** renaming or tagging 1,000 assets without changing human
  retrieval, exception handling, or decision time is not established reduction.
- **Centralization bias:** eliminating accounts can weaken boundary-based
  security or expand the failure domain; compare an alternative of centralized
  policies with accounts retained.
- **Automation camouflage:** an agent that continually maintains tags and
  inventories might shift burden into monitoring the agent, its permissions,
  data pipeline, drift and failure modes.
- **Documentation accumulation:** each new authoritative document may create
  staleness and ambiguity. Prefer replacing or deleting old interpretations.
- **Complexity displacement:** work removed from the platform team but added
  to security, legal, users, or on-call teams is not net reduction.
- **Good complexity:** segregation of duties, independent security review,
  auditable traces, geographic separation, privacy and accessibility may be
  necessary even if less convenient.

## How to verify improvement without false precision

Choose 1–3 representative, realistic questions, such as:

- "Find the owner and purpose of this randomly selected bucket."
- "Identify the affected account(s) for a plausible incident."
- "Determine who can approve this access/policy change and why."
- "Identify what stops working if this component disappears."

Time the baseline task or reconstruct past decision histories; record failure,
conflicting answers, and assistance needed. Repeat against a proposed design in
a walkthrough or safe prototype, or after separate implementation approval.
State differences in participants, task difficulty, tooling, and sample size.
No statistical significance or universal benchmark is implied by a few trials.

If no quantitative baseline is feasible, make a **testable structural claim**:
"Remove 12 bespoke bucket policies by shifting applicable members to one
reviewed policy class; then a security reviewer should consult one approved
rule instead of 12 independent documents." Verify that each member really
shares the same constraints.

## Bound investigation itself

- Prefer existing sources over creating observability systems.
- Start with a sample and known exceptional assets; expand only if it will
  influence a concrete decision.
- Stop when the likely information gain is smaller than the investigation
  cost, or when a binding constraint blocks the action anyway.
- Require a sunset or replacement plan for any new reporting artifact or review
  process proposed as part of the reduction.
