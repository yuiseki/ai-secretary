# AWS portfolio playbook: 40 accounts, 1,000 S3 buckets

This is a **portfolio diagnosis**, not an instruction to merge accounts or delete
buckets. Apply only to AWS resources the user is authorized to inspect. Prefer
existing AWS Organizations, IaC, resource inventory, billing, S3 Storage Lens,
configuration, incident and access-management evidence. Do not enable features
that change settings or incur extra cost without separate approval.

## Stage A: explain why the counts exist

For accounts, identify:

- Organization/OUs, production vs non-production, security/logging, management,
  audit, shared services, sandbox and workload boundaries.
- Data sensitivity, residency, contract, security and fault-isolation needs.
- Account vending/provisioning patterns, access/SSO role designs, service control
  policies, delegated owners, guardrails, region restrictions and account lifecycle.
- Duplicated or exceptional practices: manually provisioned accounts, separate
  approval procedures, nonstandard responders, inaccessible contacts.

For buckets, identify:

- Purpose families: application state, distribution, static hosting, artifacts,
  datasets, temporary processing, access logs, security audit, backup,
  replication, legal retention, and legacy.
- Access patterns: principals, policies, roles, cross-account access and public
  distribution where authorized; encryption, object lock, retention, lifecycle,
  versioning, replication and event notifications.
- Naming and deployment patterns: infrastructure-as-code, service-owned naming,
  unique regional/account/security constraints, ad hoc manual creation.
- Direct and hidden consumers (batch jobs, external partners, annual reports,
  incident restoration, infrastructure pipelines) and ownership.

Do not mistake an empty bucket, lack of access telemetry, no recent requests,
or a negligible bill for proof of dispensability. Never inspect object *contents*
by default; metadata and approved configurations should usually suffice.

## Stage B: diagnose the management surface

Ask real human operational questions:

1. Can a new on-call engineer locate the correct account, bucket, owner and
   escalation path without consulting private tribal knowledge?
2. How many *different* IAM/SCP/bucket-policy designs must security reviewers
   reason about, and which differences have justified needs?
3. How many exception paths exist for account creation, bucket creation,
   access requests, logging, encryption, retention and decommissioning?
4. Are there avoidable cross-account integrations and duplicated data copies?
5. What happens to triage when an alert names an unfamiliar account or bucket?
6. If a product is retired, can people identify its accounts, buckets,
   credentials, policies, billing duties and downstream consumers?

Record sample-based task duration, number of handoffs, conflicting ownership
answers, known exceptions, and failures to answer. An inventory that merely
shows all 1,040 items does not answer these questions.

## Stage C: consider structural alternatives

**Alternative 1: keep all 40 account boundaries, reduce exceptional handling.**
If production/test, legal, financial, audit and security isolation matter,
standardize only compatible account lifecycle, access request, runbook, naming,
guardrails and owner discovery patterns. Human-visible complexity may decline
without account deletion.

**Alternative 2: group bucket families by purpose and policy.**
Reduce individually interpreted policy variants and ownership ambiguity when
uniform controls are actually appropriate. The objective may be to support
1,000 buckets through a handful of verified rules plus documented exceptions.
Avoid replacing the object count with a giant unreviewable exception table.

**Alternative 3: consolidate justified duplicates.**
Where two buckets or accounts truly duplicate an outcome and boundaries permit
merging, model migration, IAM, data lineage, retention, access logs, object
versioning, backup, external dependencies, blast radius, re-creation and full
closure costs before a human approves a plan.

**Alternative 4: retire demonstrably obsolete families or isolated targets.**
Only after a per-target dependency and obligation review, with required data
preservation, rollback constraints, communications, and separate execution.
Where usage evidence is weak, propose a freeze-and-observe stage first:
remove SSO assignments or apply a deny SCP to a member account instead of
closing it; deny reads with a bucket policy instead of deleting; deactivate
access keys instead of deleting principals. Never freeze logging, audit,
backup or break-glass paths this way, and check that lifecycle expiry,
replication and inbound log delivery do not lose data during the window. See
[freeze and observe before rm](freeze-and-observe.md).

**Alternative 5: accept the shape.**
If policy variation is minimal, ownership is discoverable, incident handling is
fast, and account isolation is required, keeping 40 accounts and 1,000 buckets
may be the correct decision. Say so.

## Two illustrative findings (hypothetical, not inferred from counts)

- Finding A: 40 accounts, but 34 share the same approved vending and access
  procedures. Six have entirely custom request/incident paths; one protects
  audit evidence. **Proposal:** investigate simplifying the six paths while
  preserving the audit boundary. **Not:** merge accounts merely to meet a goal.
- Finding B: 1,000 buckets, 720 conform to four IaC/policy templates and 280 are
  unexplained. **Proposal:** sample the unexplained families, inspect protected
  outliers, and test discoverability. **Not:** label all 280 "zombies" or run a
  bulk-delete script.

## AWS evidence sources and caveats

- AWS Organizations for authorized account/OU/policy metadata; an organization
  listing alone does not prove every member is accessible for resource audits.
- AWS S3 Storage Lens for organization/account/bucket-level storage trends and
  available activity/protection metrics. Coverage, metric tiers, and bucket
  types vary: verify the actual dashboard/export before claiming completeness.
- Existing IaC, deployment workflows, IAM/access configuration, configuration
  histories, audit trails and dependency references for intent and actual use.
- Cost and storage metrics are not adequate proof of dependency or regulatory
  value; query historical depth and data coverage explicitly.

Official documentation:

- https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices.html
- https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_securely_operate_multi_accounts.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage_lens.html

## Stop conditions specific to AWS

Mark BLOCKED when a proposed reduction might compromise security/logging,
account recovery, break-glass access, backups, disaster recovery, encryption,
retention/hold obligations, isolated production trust domains, or unexplained
cross-account dependencies. Do not use a supposed human-productivity improvement
to override such duties. Account closure and bucket deletion are separate
human-approved operational change projects, not steps within this skill.
