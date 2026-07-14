# Contributing to triagekit

Thanks for considering a contribution! triagekit is small on purpose — the
whole pipeline is a few focused modules, the test suite runs in seconds, and
no test needs an API key. That makes it a friendly first codebase.

## Development setup

Requirements: Node.js >= 20.

```bash
git clone https://github.com/kero168/triagekit
cd triagekit
npm install
npm test          # vitest, ~90 tests, no network, no keys
npm run lint      # tsc --noEmit
npm run build     # tsup -> dist/
node dist/cli.js analyze examples/fixtures/bug-report-complete.json \
  --existing examples/fixtures/existing-issues.json
```

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full map. In short:

| Path | What lives there |
| --- | --- |
| `src/similarity.ts` | duplicate detection (n-gram + token Jaccard) |
| `src/labeler.ts` | rule-based classification |
| `src/repro.ts` | reproduction checklist |
| `src/llm.ts` | opt-in LLM refinement (REST, no SDKs) |
| `src/github.ts` | the two GitHub API calls we need |
| `src/analyze.ts` | pipeline orchestration |
| `src/cli.ts` | commander-based CLI |
| `test/` | unit + fixture-driven integration tests |
| `examples/fixtures/` | real-shaped issue JSON used by tests, docs and CI |

## What makes a good contribution

- **New rule signals** for `src/labeler.ts` — add the rule *and* a test with a
  realistic issue title/body. Rules must come with a human-readable `reason`.
- **Similarity improvements** — must stay dependency-free and local. Include
  before/after scores for the fixtures in your PR description.
- **New fixtures** — anonymized real-world issues that triagekit currently
  gets wrong are extremely valuable.
- **Bug fixes** — include a failing test first if you can.

## Ground rules

1. **No new runtime dependencies without prior discussion.** The runtime
   footprint is `commander` + `picocolors`, and keeping install fast is a
   feature.
2. **Everything must work without an API key.** LLM-dependent behavior is
   opt-in and must degrade gracefully. Tests mock the network.
3. **Suggestions must be explainable.** Any new signal has to surface a
   `reason` string a maintainer can audit.
4. **Tests are not optional.** `npm test` and `npm run lint` must pass; CI
   runs them on Node 20 and 22.

## Pull request flow

1. Fork, create a branch (`feat/...`, `fix/...`, `docs/...`).
2. Make the change with tests.
3. Open a PR using the template. Small, focused PRs merge fastest.
4. A maintainer reviews — expect a first response within a week (see
   [GOVERNANCE.md](GOVERNANCE.md)).

## Commit style

Conventional-ish prefixes are appreciated but not enforced:
`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.

## Release process (maintainers)

1. Update `CHANGELOG.md` and bump `version` in `package.json` **and**
   `src/version.ts` (they are checked by eye — keep them in sync).
2. Tag `vX.Y.Z`, publish a GitHub Release.
3. The `release.yml` workflow builds, tests, and publishes to npm via
   trusted publishing (OIDC) — no token secret involved.
4. Move the `v0` major tag: `git tag -f v0 vX.Y.Z && git push -f origin v0`.
