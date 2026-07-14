# Roadmap

Direction for triagekit. Items move via issues/PRs — this file states intent,
not promises. If something here matters to you, open an issue and say so;
demand reorders the roadmap.

## v0.2 — smarter matching, configurable taxonomy

- **Body-text similarity**: extend duplicate detection beyond titles with a
  weighted title+body score (still local, still key-free).
- **`.triagekit.json`**: configurable label taxonomy and per-label keyword
  additions, so projects with `kind/bug`-style labels can map the output.
- **`--apply-labels`**: optionally apply the top suggestion via the API
  (opt-in, threshold-gated) instead of only suggesting it.
- **Issue-form awareness**: parse GitHub issue-form field headings for more
  reliable repro detection.

## v0.3 — scale and reach

- **`triagekit sweep`**: batch mode that triages an existing backlog and
  emits a prioritized report (JSON + Markdown summary).
- **GitLab support**: analyze GitLab issues, post notes (tracked in the
  community's most-requested-feature issue).
- **Comment templates**: customizable/localizable comment wording (starting
  with Japanese).

## v1.0 — stability contract

- Frozen, documented JSON output schema (semver-governed).
- GitHub Enterprise Server verified (GITHUB_API_URL already supported).
- Performance target: analyze against 1,000 existing issues in < 1s.
- Marketplace listing polish and versioned major tag discipline (`v1`).

## Explicit non-goals

- **Auto-closing issues.** triagekit suggests; humans decide.
- **Becoming an LLM wrapper.** The key-free local path stays first-class
  forever — it is the point of the project.
- **Kitchen-sink workflow automation.** Stale-bot features, PR triage, and
  project-board automation are better served by dedicated tools.
