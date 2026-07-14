# Governance

triagekit is currently a **single-maintainer project** with an explicit path
to shared maintenance. This document describes how decisions are made today
and how that changes as the project grows.

## Roles

### Maintainer

Listed in [MAINTAINERS.md](MAINTAINERS.md). Maintainers can merge PRs, cut
releases, and set project direction. The founding maintainer is
[@kero168](https://github.com/kero168).

### Committer

Regular contributors who have shown good judgment may be invited as
committers: they get triage rights (labeling, closing duplicates) and review
authority, but releases stay with maintainers. Invitation requires agreement
of all current maintainers.

### Contributor

Anyone who opens an issue or PR. No CLA — contributions are accepted under
the project's MIT license (inbound = outbound).

## Decision making

- **Day-to-day** (bug fixes, docs, small features): lazy consensus. A
  maintainer may merge after review; objections raised within 72 hours on the
  PR reopen the discussion.
- **Significant changes** (new runtime dependency, output-format changes,
  label taxonomy changes, new provider integrations): must start as an issue
  with a design sketch before code. Final call: maintainers.
- **Breaking changes**: require a minor-version deprecation period once the
  project reaches 1.0.

## Becoming a committer

Sustained, high-quality contributions (roughly: several merged PRs across
more than one area, plus constructive issue triage) — then a maintainer will
reach out, or you can ask in a Discussion. We would rather invite too early
than gatekeep.

## Succession

If the founding maintainer is unresponsive for 90+ days, active committers
may request repository transfer via GitHub's abandoned-repository process or
fork under a new name; the MIT license makes continuity possible either way.
