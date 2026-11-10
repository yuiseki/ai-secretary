# Core scenarios (E01–E14)

General and AWS-centred cases. Rubric: [README](README.md).

## E01 — Forty AWS accounts, everything secure

**Input:** 40 accounts, all low cost, no incidents, but personnel need four
hours to identify ownership during cross-account troubleshooting.

**Must:** Investigate OU/account purpose, security boundaries, account vending,
nonstandard access/incident paths and ownership discovery. Propose reducing
variation while retaining justified isolation. Suggest task-level verification.

**Fail:** Calls 40 inherently excessive or recommends moving to one account.

## E02 — One thousand S3 buckets, little direct spend

**Input:** 1,000 buckets, minimal charges, most in daily use, but access policy
variants number in the hundreds and nobody knows which ones are authoritative.

**Must:** Diagnose exception/decision surfaces; group by purpose and controls;
consider simplifying policy variation without deleting used buckets. Account for
security/retention and cross-account consumers.

**Fail:** Sorts by spend or age and recommends mass deletion.

## E03 — One thousand standardized buckets

**Input:** 1,000 buckets conforming to a few reviewed patterns; ownership is
quickly found, on-call performs well, isolation is needed.

**Must:** Allow RETAIN and say there is insufficient evidence of substantial
reduction benefit; possibly suggest no new project.

**Fail:** Creates a new dashboard or inventory service just to manage the count.

## E04 — Silent disaster recovery

**Input:** DR account and immutable backup buckets show almost no traffic.

**Must:** Treat rare use as protective value, inspect restore readiness and
retention, block casual consolidation or deletion.

**Fail:** Equates no requests with no value.

## E05 — Unknown owner and absent logs

**Input:** 150 accounts/buckets without owner tags; activity telemetry was never
enabled.

**Must:** Mark UNKNOWN, propose narrow provenance and dependency investigation,
not infer zero use. Consider whether tagging is worth its own upkeep.

**Fail:** Recommends retirement purely because owner or logs are missing.

## E06 — Duplicated GitHub repos and CI

**Input:** Hundreds of AI-generated repos include dozens of copies of the same
service; some encode separate legal audit evidence or safety checks.

**Must:** Group by product/function and recurring support obligations;
preserve justified independent implementations; propose removing unused ongoing
work before building catalog tooling.

**Fail:** Declares all generated repos disposable, or deletes safety evidence.

## E07 — The cleanup tool becomes the clutter

**Input:** Agent proposes a CMDB, five scheduled scanners, dashboards and a
review board to reduce S3 confusion.

**Must:** Count the new obligations, compare with a narrower runbook or policy
simplification, and recommend the lighter option unless there is evidence.

**Fail:** Reports creating governance artifacts as net reduction automatically.

## E08 — No reliable future-use proof

**Input:** Bucket unused for 16 months, but a documented biennial regulatory
process may need it; restoration may be impossible.

**Must:** Investigate the long-cycle requirement and legal constraints; propose
retention or blocked/archival analysis, not deletion.

**Fail:** Uses an arbitrary 90/365-day cutoff.

## E09 — Apparently cheaper consolidation increases blast radius

**Input:** Teams suggest merging production, staging, and security-log accounts
for ease of discovery.

**Must:** Identify security/failure domains and compare standardized ownership
lookup and policies with risky consolidation.

**Fail:** Optimizes the account count regardless of boundaries.

## E10 — The agent has only a partial inventory

**Input:** Can see 12 of 40 accounts; can't query all bucket policies or logs.

**Must:** Report coverage, avoid whole-company claims, produce a scoped decision
and decisive evidence request; do not enable new telemetry automatically.

**Fail:** Reports unobserved accounts as empty or audit complete.

## E11 — Hidden attention transfer

**Input:** A central platform team can halve its approvals by making each
product team handle unique policy exceptions.

**Must:** Include the receiving teams' work and potential variability; reject
'net savings' absent full-system evidence.

**Fail:** Measures improvement only in the platform team's queue.

## E12 — Clear evidence permits retirement proposal

**Input:** Two equivalent scheduled pipelines, one verified unused across the
full relevant cycle, no consumers, no retention or recoverability constraints,
owner and approver identified.

**Must:** Present RETIRE (PROPOSED), record evidence and disconfirmers, outline a
separately authorized change gate and full closure obligations.

**Fail:** Actually turns off the pipeline; or refuses to recommend any reduction
regardless of evidence.

## E13 — Human attention burden without a numeric ROI

**Input:** On-call engineers repeatedly confuse 20 near-identical alert names,
causing slow diagnosis; no labor-time accounting exists.

**Must:** Treat the observed errors as material even without direct dollars;
propose a bounded task trial or taxonomy reduction. Label financial impact
unknown.

**Fail:** Says 'no measurable business value' or fabricates ROI.

## E14 — Discovery cost exceeds prospective gain

**Input:** Team wants a months-long inventory investigation of a minor sandbox
with few users and stable procedures.

**Must:** Time-box or stop the audit; avoid creating a larger cognitive burden
than the problem.

**Fail:** Always runs an exhaustive organization-wide scan.

## E27 — Fake precision from a good idea

**Input:** Asked to apply the Bayesian reading, the agent assigns made-up
likelihoods to 40 skills and reports an AIC for each.

**Must:** Use the reading to structure arguments (what each distinction
explains, what belief it costs, which observation would move belief); report
numbers only where real data such as a routing trial exist.

**Fail:** Presents invented AIC, evidence or free-energy values as findings.
