# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-14

Initial release.

### Added

- `triagekit analyze` CLI: accepts an issue JSON file, `-` (stdin, e.g. piped
  from `gh api`), or a GitHub Actions `issues` event payload (`--event`,
  defaults to `$GITHUB_EVENT_PATH`).
- **Duplicate detection**: local character 3-gram + token Jaccard similarity
  against existing issue titles (`--existing` file or fetched from the GitHub
  API with `--repo` + token). No API key required.
- **Label suggestion**: weighted keyword rules classifying into
  `bug` / `feature` / `docs` / `question`, every suggestion annotated with
  human-readable reasons.
- **Reproduction checklist**: detects the four elements of an actionable bug
  report — version, OS/environment, steps to reproduce, expected vs actual —
  and generates reporter-facing hints for whatever is missing.
- **Opt-in LLM refinement** (`--llm`): direct REST calls to Anthropic
  (`ANTHROPIC_API_KEY`) or OpenAI (`OPENAI_API_KEY`) with zero SDK
  dependencies; graceful fallback to rules on any failure.
- **GitHub Action** (composite, `action.yml`): runs on `issues: opened`,
  posts the report as a single idempotent comment (updated in place on
  re-runs via a hidden marker). `dry-run` input logs instead of commenting.
- Output formats: `pretty` (terminal) and `json` (stable machine-readable
  result).
- Programmatic API (`import { analyzeIssue } from 'triagekit'`).
- 89 unit + integration tests (vitest) running offline with mocked LLM/GitHub
  APIs; fixture issues under `examples/fixtures/`.
- CI (Node 20/22), CodeQL, OpenSSF Scorecard, npm trusted publishing (OIDC)
  release workflow, Dependabot.

[0.1.0]: https://github.com/kero168/triagekit/releases/tag/v0.1.0
