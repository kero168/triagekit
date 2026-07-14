# triagekit

> AI-powered issue triage for GitHub — dedupe, label, and demand reproductions, as an Action or CLI.

[![CI](https://github.com/kero168/triagekit/actions/workflows/ci.yml/badge.svg)](https://github.com/kero168/triagekit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/triagekit)](https://www.npmjs.com/package/triagekit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

[日本語 README](README.ja.md) · [Quick start](docs/quickstart.md) · [Action guide](docs/action.md) · [Architecture](ARCHITECTURE.md) · [Roadmap](ROADMAP.md)

Every "it doesn't work" issue costs a maintainer the same three questions:
*is this a duplicate? what kind of issue is it? can I even reproduce it?*
triagekit answers all three the moment an issue is opened — and it works
**without any API key**: duplicate detection and classification run on local
heuristics, with LLM refinement as a strict opt-in.

The GitHub Actions Marketplace is crowded with labelers and staleness bots,
but purpose-built *issue triage* — dedupe + classify + reproduction check in
one step — is still a thin category. triagekit aims to be the default answer
for it.

## 30-second demo

```console
$ gh api repos/OWNER/REPO/issues/102 | npx triagekit analyze - --existing issues.json

triagekit v0.1.0 — #102 "It doesn't work, error every time"

Suggested labels
  bug      0.68  mentions an error or exception (in title); says something does not work (in title)

Possible duplicates (scanned 5 issues, threshold 0.45)
  none found

Reproduction checklist [0/4]
  - Version information  State the exact version of this project (and your runtime, e.g. Node.js) where the problem occurs.
  - Operating system / environment  Mention your OS or environment (e.g. macOS 14, Ubuntu 24.04, Windows 11, Docker, GitHub Actions runner).
  - Steps to reproduce  List the exact commands or numbered steps that trigger the problem, ideally in a code block.
  - Expected vs actual behavior  Describe what you expected to happen and what actually happened instead.
```

A well-written report scores `[4/4]` and gets a thank-you instead of a nag.

## Quick start (CLI)

```bash
# Analyze an issue fetched with the GitHub CLI
gh api repos/OWNER/REPO/issues/123 | npx triagekit analyze -

# Analyze a local issue JSON against a list of existing issues
npx triagekit analyze issue.json --existing issues.json

# Machine-readable output
npx triagekit analyze issue.json --format json

# Let the CLI fetch open issues itself (duplicate detection needs a token)
GITHUB_TOKEN=$(gh auth token) npx triagekit analyze issue.json --repo OWNER/REPO
```

Try it right now with the fixtures in this repo:

```bash
git clone https://github.com/kero168/triagekit && cd triagekit
npm install && npm run build
node dist/cli.js analyze examples/fixtures/bug-report-missing-repro.json \
  --existing examples/fixtures/existing-issues.json
```

## Add it to your repo in 4 lines

```yaml
steps:
  - uses: kero168/triagekit@v0
    with:
      github-token: ${{ github.token }}
```

Full workflow (`.github/workflows/triage.yml`):

```yaml
name: Issue triage
on:
  issues:
    types: [opened]

permissions:
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: kero168/triagekit@v0
        with:
          github-token: ${{ github.token }}
          # dry-run: 'true'      # log instead of commenting, great for trials
          # llm: 'true'          # opt-in LLM refinement (see below)
```

When an issue is opened, triagekit posts one comment with the suggested
label, duplicate candidates, and a checklist of missing reproduction info.
Re-runs **update the same comment** (identified by a hidden marker) — your
issues never drown in bot noise. See [docs/action.md](docs/action.md) for all
inputs.

## What it checks

| Check | How it works | Needs an API key? |
| --- | --- | --- |
| **Duplicate detection** | Character 3-gram + token Jaccard similarity against open issue titles, fully local | No |
| **Label suggestion** (`bug` / `feature` / `docs` / `question`) | Weighted keyword rules with per-match explanations; optional LLM refinement | No (LLM opt-in) |
| **Reproduction checklist** | Detects the 4 elements of an actionable bug report: version, OS, steps, expected vs actual | No |

Every suggestion ships with its reasons (`"mentions a crash (in title)"`),
because a triage bot maintainers can't audit is a triage bot they'll disable.

## LLM refinement (opt-in)

Set `--llm` (CLI) or `llm: 'true'` (Action) and provide **one** key:

| Provider | Environment variable | Default model |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-3-5-haiku-latest` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |

Override the model with `TRIAGEKIT_LLM_MODEL`. The provider is called
directly over REST with the built-in `fetch` — triagekit adds **no SDK
dependencies**. If the key is missing or the call fails, triagekit reports it
and falls back to rule-based results; the run never breaks.

```yaml
- uses: kero168/triagekit@v0
  with:
    llm: 'true'
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Output formats

- `--format pretty` (default) — colored, human-readable terminal report
- `--format json` — the full `AnalysisResult`, stable and documented in [ARCHITECTURE.md](ARCHITECTURE.md), for piping into your own tooling

## Comparison

| | triagekit | `actions/labeler` | Stale bots | Generic LLM bot |
| --- | --- | --- | --- | --- |
| Duplicate candidates on open | **Yes, local similarity** | No | No | Sometimes, needs API key |
| Label suggestion with reasons | **Yes** | Path/glob rules only | No | Opaque |
| Reproduction-info checklist | **Yes (4 elements)** | No | No | Rarely |
| Works with zero API keys | **Yes** | Yes | Yes | No |
| Same engine as a local CLI | **Yes** | No | No | Rarely |
| Idempotent single comment | **Yes** | n/a | n/a | Usually re-posts |

## Programmatic API

```ts
import { analyzeIssue, formatComment } from 'triagekit';

const result = await analyzeIssue(
  { number: 1, title: 'CLI crashes on save', body: '...' },
  [{ number: 12, title: 'Crash when saving config' }],
);
console.log(result.labels[0]);   // { label: 'bug', confidence: 0.71, reasons: [...], source: 'rules' }
console.log(formatComment(result));
```

## Roadmap

- **v0.2** — body-text similarity, configurable label taxonomy (`.triagekit.json`), `--apply-labels`
- **v0.3** — batch mode for existing backlogs (`triagekit sweep`), GitLab support
- **v1.0** — stable JSON output contract, GHES-tested, i18n comment templates

Details and status: [ROADMAP.md](ROADMAP.md).

## Contributing

Contributions are welcome — especially new rule signals, similarity
improvements, and real-world fixture issues. Start with
[CONTRIBUTING.md](CONTRIBUTING.md); the whole test suite runs in seconds with
`npm test` and no test requires an API key.

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)
- [Governance](GOVERNANCE.md)

## License

[MIT](LICENSE) © kero168
