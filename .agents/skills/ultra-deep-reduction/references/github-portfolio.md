# GitHub portfolio playbook: 1,000 repositories

This is a **portfolio diagnosis**, not an instruction to archive, delete, rename,
transfer, merge, or change the visibility of repositories. Apply only to owners
(personal accounts, organizations, enterprises) the user is authorized to
inspect. Prefer metadata that already exists: repository settings, workflow
files, rulesets, CODEOWNERS, release and package listings, issue history, and the
owner's own notes. Do not clone every repository, enable features, or change
settings to gather evidence without separate approval.

## Why repositories are a distinct case

A repository is not only code storage. One repository can simultaneously be:

- A **distribution point**: release assets, GitHub Pages, container images or
  packages, raw file URLs, Go module paths, install scripts that `curl` from it.
- A **dependency of other repositories**: reusable workflows and actions
  referenced as `uses: owner/repo/...@ref`, submodules, templates, shared config.
- A **running job**: scheduled workflows, bots, self-hosted runners, webhooks,
  deploy keys and secrets that touch cloud accounts, datasets or other services.
- A **record**: issues, pull requests, reviews and discussions that document
  why decisions were made; provenance of published data, papers or talks;
  citation targets (DOIs, CITATION files, links from publications).
- An **identity**: a URL that external people, search engines, package
  registries, blog posts and forks point at.

So "no commits for two years" says little about value. A dormant repository can
still be the canonical download link for a dataset, the source of a reusable
action used by 40 other repositories, or the only record of a past incident.

## Stage A: explain why the count exists

Enumerate **kinds**, not rows. Typical families:

- Active products/libraries; deployed services and their infrastructure code.
- Forks: upstream contribution forks, patched forks actually depended on,
  forks kept only as bookmarks.
- Experiments, prototypes, hackathon and talk demos; AI-generated attempts at
  the same idea.
- Data and publication repositories: dataset builders, papers, slides, sites.
- Configuration and automation: dotfiles, CI templates, reusable actions,
  bots, scheduled jobs.
- Mirrors, archives already marked archived, and template repositories.

For each family identify: owner (personal vs organization), visibility, license,
whether it publishes anything (Pages, releases, packages, images), whether it
runs anything (scheduled workflows, webhooks, apps, runners), whether other
repositories reference it, and who besides the owner may depend on it.

Read-only sources that usually suffice:

- `gh repo list <owner> --limit 2000 --json name,isArchived,isFork,isTemplate,visibility,pushedAt,licenseInfo,repositoryTopics,homepageUrl,description` (or the GraphQL API) for one compact inventory.
- Workflow files (`.github/workflows/*.yml`) via the contents API for
  `schedule:` triggers, `uses:` references, deploy targets and secrets used.
- Code search for references **to** a repository from other repositories
  (`uses: owner/name`, submodule URLs, raw URLs, module paths).
- Release, package, Pages and environment listings.

Respect API rate limits. If local analysis of cloned repositories is genuinely
needed, clone only a sample, and cap memory and CPU of the analysis process.

## Stage B: diagnose the management surface

Ask the human operational questions:

1. Given a URL, error message or alert naming a repository, how long does it
   take to know what it is, whether it is canonical, and who answers for it?
2. Among near-duplicates (copies of the same service, several attempts by an
   AI agent, fork vs original), can a person tell which one is authoritative
   without opening each?
3. How many **different** CI setups, branch protections/rulesets, release
   processes, dependency-update configurations and license choices must be
   understood? Which differences are justified?
4. How much **alert and notification volume** do the repositories generate
   (Dependabot or code-scanning alerts, failed scheduled workflows, issue
   notifications) and how much of it is triaged versus ignored? Ignored alerts
   on dormant repositories are a burden even when nothing is deployed.
5. Which repositories hold **live credentials or permissions**: secrets, deploy
   keys, OIDC trust to cloud accounts, GitHub App installations, self-hosted
   runners? These carry security obligation regardless of activity.
6. When a product or experiment ends, can someone list its repositories,
   schedules, secrets, packages, Pages sites and external links?

Record sample-based task durations, wrong or conflicting answers, and failures to
answer. A spreadsheet of 1,000 rows does not answer these questions.

## Stage C: consider structural alternatives

**Alternative 1: keep the repositories, reduce variation.** Converge CI, rulesets,
update bots and release steps on a few reviewed patterns (for example reusable
workflows or organization rulesets) where constraints really are shared.
Document the remaining justified exceptions.

**Alternative 2: make canonicality visible.** For duplicate families, decide
which one is canonical and mark the others in place (description, README
banner, topic) rather than building a catalog service. Check that the marking
changes what a person actually does in Stage B tasks.

**Alternative 3: freeze dormant repositories (archive, proposed).** Archiving
keeps history, URLs and releases readable while making the repository
read-only, and it can be undone by unarchiving. Before proposing it, check what
stops: scheduled workflows, issue intake from external users, updates that a
published artifact or Pages site relies on. Archiving does not by itself remove
secrets, deploy keys, app installations or runner access; list those as a
separate obligation.

**Alternative 4: retire live obligations, keep the record.** Often the burden is
not the repository but what it runs or holds: a forgotten scheduled job, an
unused secret, a stale webhook, an app installed everywhere. Removing those
obligations (as a separate authorized change) can reduce risk and attention
more than deleting history.

**Alternative 5: retire repositories (proposed).** Only per target, after a
reference search across all owners, checking external consumers, published
artifacts, citations, licenses and forks. Archiving for a fixed window, with a
README banner saying whom to contact, is the natural freeze-and-observe stage
before any deletion; making a repository private is not, because outsiders lose
the URL they would complain about (see
[freeze and observe before rm](freeze-and-observe.md)). Treat deletion, transfer, rename and
visibility changes as irreversible-in-practice for outside consumers even when
GitHub offers partial restoration.

**Alternative 6: accept the shape.** Many small, independent, clearly described
repositories with uniform CI and no live credentials can be the simplest
arrangement. Say so.

## GitHub-specific hazards

- **Rename and transfer** leave redirects, but a redirect breaks if a new
  repository later takes the old name; Go module paths, raw URLs and `uses:`
  references in other repositories may stop resolving.
- **Visibility changes** affect outsiders: making a public repository private
  hides releases, Pages and raw URLs from everyone else, and GitHub documents
  that stars and watchers are lost. Public forks of it may remain public.
- **Reusable workflows and actions** referenced by other repositories are
  shared foundations even when their own repository looks idle.
- **Forks with patches** may be what a deployed system actually builds from;
  "it's only a fork" is not evidence of no value.
- **Telemetry is shallow:** repository traffic insights cover only a short
  recent window and are visible only to people with push access; clones by CI,
  package-registry downloads and links from outside are partly or wholly
  invisible. Absence of traffic data is UNKNOWN, not zero.
- **AI-generated duplicates** are a reason to ask which one is canonical and
  which ongoing obligations each one carries, not a reason to treat generated
  code as disposable (see [other domains](other-domains.md)).

## Two illustrative findings (hypothetical, not inferred from counts)

- Finding A: 1,000 repositories, 850 have no workflows, no secrets and nothing
  published; 120 run scheduled workflows, 30 of which have failed silently for
  months. **Proposal:** investigate the 30 failing schedules first (each is an
  obligation someone believes is running). **Not:** archive the 850 to make
  the number smaller.
- Finding B: 14 copies of the same map viewer, one deployed through Pages and
  linked from a talk. **Proposal:** mark the deployed one canonical, check which
  copies other repositories or links reference, then propose archiving the rest.
  **Not:** delete the copies before the reference search.

## Official documentation

- https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories
- https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility

Verify current behavior in these pages before relying on it in a decision.

## Stop conditions specific to GitHub

Mark BLOCKED when a proposed reduction might break a published artifact or
URL with unknown external consumers, a reusable workflow or action referenced
elsewhere, a module or package path, a citation or DOI target, license or
attribution obligations, records needed for audit or provenance, or a
repository holding live credentials whose consumers are unknown. Archiving,
deletion, transfer, rename and visibility changes are separate human-approved
changes, not steps within this skill.
