# Domain adaptations

Apply the same **portfolio → decision surface → protected boundaries →
structural alternatives** sequence rather than evaluating all items alone.

## AI-generated code, repositories and services

Observe: overlapping features, near-identical microservices, distinct
frameworks, configuration variants, orphaned CI pipelines, deploy targets,
models, prompts, test harnesses and scripts. Assess whether they create new
release, incident, security, license, onboarding and support decisions.

Do not call an experiment valueless because it lacks traffic; consider explicit
research learning and reproducibility. Do not automatically fold safety tests,
independent verification, immutable provenance, or deliberately independent
implementations into one implementation. Propose which concepts or ongoing
obligations disappear if something is retired, and how useful knowledge is kept.
For a large set of GitHub repositories, follow
[the GitHub portfolio playbook](github-portfolio.md); for accumulated agent
skills, [the Agent Skills playbook](agent-skills-portfolio.md).

## Corporate IT / SaaS sprawl

Inspect: app catalog, license holders, SSO and SCIM flows, device management,
shadow integrations, paid seats, duplicate procurement, access-review
exceptions, renewals, data residency, vendor contracts, incident obligations,
data portability and offboarding. For chat channel sprawl (Slack, Teams,
Discord), follow [the Slack portfolio playbook](slack-portfolio.md). One SSO app used yearly for taxes may be
critical; a low-cost app with repeated access confusion may be costly in
attention. Avoid treating employee behavior or identity as a personal failure.

## Data, analytics and GIS

Inspect: duplicated datasets, stale materialized views, lineage and provenance,
licenses, citation/reproducibility obligations, schemas, coordinate reference
system variants, transformation pipelines, refresh jobs and retention. A
rarely queried dataset can be authoritative or necessary for historical
reproduction. Deleting the data may be worse than consolidating indexes,
redundant derived copies or schema variants. Any archival strategy must preserve
license obligations, data provenance and restoration feasibility.

## System administration and operational processes

Inspect: monitoring rules, alert classes, dashboards, tickets, cron jobs,
runbooks, approvals, handoffs, inventory catalogs and review meetings. A
monitoring system added to tame complexity is itself an asset; require evidence
that a proposed extra alert, report or agent decreases total human response and
uncertainty rather than producing more noise.

## Organizational policy and compliance

Trace each policy to author, accountable reviewer, current legal/contractual
basis, protected failure, affected stakeholders and authorized change path.
Simplify duplicated interpretations and control evidence requests where legal
obligations permit. Never advise omitting statutory duties, mandatory records,
accessibility protections or security segregation simply because they impose
cognitive cost.

## Cross-domain stopping question

After proposing any new standard or tool, ask: "Who must now understand,
maintain, secure, fund, audit, and retire **this new thing**? Which old
obligations genuinely disappear?" If the answer is not clear, prefer a smaller
experiment or no change.
