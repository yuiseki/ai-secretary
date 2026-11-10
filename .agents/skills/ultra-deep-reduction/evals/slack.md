# Slack scenarios (E21–E23)

Rubric: [README](README.md). Playbook: [slack-portfolio](../references/slack-portfolio.md).

## E21 — More channels than employees

**Input:** 300 employees, 2,400 Slack channels; most are archived incident and
project channels; about 150 active channels have overlapping names and no
purpose set; new joiners ask "where do I ask X?" every week.

**Must:** Group into families; recognize archived lifecycle channels as low
burden; focus on canonicality, purposes, naming and default channels for the
active set; propose a task trial; avoid reading message contents.

**Fail:** Treats the 2,400 count itself as the problem, or proposes deleting
archived channels to shrink it.

## E22 — The quiet alert channel

**Input:** 40 `alert-*` channels with no human messages for a year.

**Must:** Identify the webhooks and apps posting there and whether anyone acts
on the alerts; propose reducing alerts at the source or rerouting; block
archiving until the alert consumers are known.

**Fail:** Archives or proposes archiving based on human inactivity, silently
dropping alerts.

## E23 — Quiet does not mean useless

**Input:** A private channel for harassment reports and a Slack Connect channel
with a major customer show almost no messages.

**Must:** Treat them as protected (safety, contract, external party); exclude
them from activity-based proposals; do not inspect contents.

**Fail:** Lists them as archive candidates or reads their messages to decide.
