# Slack portfolio playbook: more channels than people

This is a **portfolio diagnosis**, not an instruction to archive, delete, rename,
merge, or convert channels, or to change membership or integrations. Apply only
to workspaces the user is authorized to inspect. The same reasoning applies to
Microsoft Teams, Discord, Mattermost and similar chat systems.

Having more channels than employees is not a verdict. Per-incident, per-project
and per-customer channels can be deliberate and cheap when they are created and
archived by a known convention. The burden worth reducing is elsewhere: in what
**every person** must decide each day (where to post, where to look, what to
join or mute, which of several look-alike channels is canonical) and in channels
that silently carry machine traffic or obligations.

## Why chat channels are a distinct case

- **The burden is distributed.** A redundant bucket burdens a platform team; a
  redundant channel taxes every member's attention, search results and
  onboarding. Most of this cost is propagation burden borne by people who did
  not create the channel.
- **Content is people's speech.** Messages, including in public channels, are
  personal communications. Work from metadata (name, purpose, topic, creator,
  creation date, member count, last activity, connected apps) and from the
  owners' own descriptions. Do not read, export or summarize message contents,
  and never private channels or DMs, without explicit authorization for that
  purpose. Do not profile individuals' activity.
- **Channels are records.** Incident channels, decision threads, customer
  conversations and approvals can be evidence for postmortems, audits, disputes
  and legal holds. Retention policies and plan-dependent history limits apply;
  verify them before any proposal.
- **Channels are also endpoints for machines.** Monitoring alerts, CI results,
  incoming webhooks, bots, workflows and scripts post to channels by ID or name.
  Archiving such a channel can drop alerts without anyone noticing.
- **Channels are also community and safety spaces.** Social channels, employee
  groups, accessibility or support channels, and confidential channels for HR,
  security or reporting concerns have value that does not show up as activity.
  Low activity in a reporting or emergency channel is the expected, healthy state.

## Stage A: explain why the count exists

Enumerate **kinds**, not rows. Typical families:

- Organization structure: company-wide announcements, departments, teams.
- Work units with a lifecycle: projects, incidents, launches, events, hiring
  loops, customer deals.
- Topics and interest: technologies, communities of practice, social channels.
- External: Slack Connect channels shared with customers, partners or vendors.
- Machine channels: alerts, CI/CD, monitoring, bots, feeds, logs.
- Restricted: HR, legal, security, executive, incident response, reporting.
- Duplicates and orphans: near-identical names, channels whose creator left,
  channels with zero or one member.

For each family identify: who creates and who archives them, naming convention
(if any), default/auto-join settings, retention policy, connected apps and
webhooks, external parties, and an accountable owner or role.

Read-only sources that usually suffice: the admin channel list and channel
analytics where the plan provides them, channel metadata via the API with
read-only scopes, the installed-apps list, and any existing naming or
lifecycle guideline. Ask before requesting broader API scopes.

## Stage B: diagnose the management surface

Ask the human operational questions:

1. A new employee has a question about X. How many channels must they consider,
   and how long until they find the right one? Do people disagree on the answer?
2. How many near-identical channel families exist (`#dev`, `#engineering`,
   `#dev-team`, `#eng-general`), and which one is canonical for what?
3. How often are the same questions or announcements cross-posted to several
   channels? How often do people ask "which channel is this for?"
4. Which channels does onboarding auto-join, and how many of them do new
   joiners immediately mute or leave? (Use aggregate counts only.)
5. When an alert channel goes quiet, would anyone notice that alerts stopped
   arriving, or would they assume all is well?
6. When a project, incident or customer engagement ends, does anything archive
   its channel, or does it stay in everyone's sidebar and search results?

Prefer small task trials ("find where to ask about expense approval") and
aggregate, consented observations over individual activity tracking.

## Stage C: consider structural alternatives

**Alternative 1: remove the obligation via lifecycle.** Give lifecycle channels
(project, incident, event, deal) an explicit end: archive when the work closes.
This often removes more active burden than any merge, without touching history.

**Alternative 2: reduce variation in naming.** A small set of prefixes
(`proj-`, `inc-`, `team-`, `ext-`, `alert-`) lets people classify a channel
without opening it. Renaming has costs: integrations, links and bookmarks that
use names, and people's habits. Verify that names are not hard-coded before
proposing mass renames, and prefer applying conventions to new channels first.

**Alternative 3: make canonicality visible, then consolidate duplicates.**
Set purpose and topic on the canonical channel, point the duplicates at it, and
only then propose archiving them. Merging moves conversation but not history;
note that the old channel remains the record of past decisions.

**Alternative 4: narrow defaults.** Fewer auto-join channels for new members can
reduce everyone's daily decision surface more than archiving hundreds of
channels nobody sees.

**Alternative 5: separate machine channels from human ones.** Check whether
alerts nobody reads should be routed, reduced at the source, or retired, rather
than archiving the channel and losing the signal.

**Alternative 6: accept the shape.** Thousands of archived-on-completion
channels with clear prefixes and a short list of active, well-described
channels can be a healthy portfolio. Say so.

## Freeze and observe for channels

For Slack, **archiving is usually the freeze, and often the end state.** An
archived channel keeps its history searchable and can be unarchived, while it
disappears from sidebars and stops accepting posts. Deletion erases records and
is rarely needed; propose it only for specific reasons (for example data posted
in error, under the applicable retention and privacy rules) and as a separate
decision.

Before proposing archiving, apply [freeze and observe before rm](freeze-and-observe.md):

- Post a notice in the channel first, saying when and why it will be archived,
  where conversation continues, and whom to contact to restore it.
- Check connected apps, incoming webhooks, workflows and scripts that post to
  it; they cannot complain and will fail quietly.
- Check Slack Connect channels with the external party's relationship owner;
  archiving affects people outside the organization and possibly contracts.
- Exclude restricted, safety, reporting and incident-response channels from
  activity-based proposals.
- Confirm who can unarchive under the workspace's settings, and how quickly.
- Observe unarchive requests, questions in the successor channel, and
  integration errors for a window that matches the channel's cycle (quarterly
  reviews, annual events, seasonal projects).

## Two illustrative findings (hypothetical, not inferred from counts)

- Finding A: 300 employees, 2,400 channels; 1,900 are already archived
  incident and project channels following a prefix convention; 120 active
  channels have no purpose set and overlapping names. **Proposal:** decide
  canonical channels in the overlapping families and set purposes; leave the
  archived history alone. **Not:** delete 1,900 archived channels to shrink a
  number nobody sees.
- Finding B: 40 `alert-*` channels, half with no human reading them.
  **Proposal:** trace each alert source and whether anyone acts on it; reduce
  alerts at the source where nobody does. **Not:** archive the channels, which
  would make the alerts vanish silently.

## Official documentation

- https://slack.com/help/articles/213185307-Archive-or-delete-a-channel
- https://slack.com/help/articles/203457187-Customize-message-and-file-retention-policies

Verify current behavior and plan limits in these pages before relying on them
in a decision.

## Stop conditions specific to chat channels

Mark BLOCKED when a proposed reduction might affect legal holds or retention
duties, incident or audit evidence, external Slack Connect relationships,
alert or integration delivery whose consumers are unknown, confidential or
safety channels, or accessibility and support spaces for specific groups.
Archiving, deletion, renaming, conversion, membership changes and changes to
default channels are separate human-approved changes, not steps within this
skill.
