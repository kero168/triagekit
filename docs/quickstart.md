# Quick start (CLI)

## Install

```bash
npm install -g triagekit     # or: npx triagekit ...
triagekit --version          # 0.1.0
```

Requires Node.js >= 20.

## Analyze a single issue

The analyzer accepts an issue JSON in any of three ways:

```bash
# 1. A file
triagekit analyze issue.json

# 2. Stdin (pairs perfectly with the GitHub CLI)
gh api repos/OWNER/REPO/issues/123 | triagekit analyze -

# 3. A GitHub Actions event payload
triagekit analyze --event "$GITHUB_EVENT_PATH"
```

Both the raw REST issue object and the full `issues` event payload (with the
issue nested under `.issue`) are understood.

## Duplicate detection

Duplicates are found by comparing titles with local n-gram + token
similarity. Give the analyzer existing issues either as a file:

```bash
gh api 'repos/OWNER/REPO/issues?state=open&per_page=100' > issues.json
triagekit analyze issue.json --existing issues.json
```

...or let it fetch them (needs a token with `issues: read`):

```bash
GITHUB_TOKEN=$(gh auth token) triagekit analyze issue.json --repo OWNER/REPO
```

Tune with `--threshold 0.45` (similarity floor, 0..1) and
`--max-duplicates 3`.

## Output

```bash
triagekit analyze issue.json                 # pretty terminal report
triagekit analyze issue.json --format json   # full AnalysisResult (see ARCHITECTURE.md)
```

Exit code is `0` on success, `1` on input/API errors — the analysis itself
never fails an issue.

## Posting a comment

```bash
GITHUB_TOKEN=... triagekit analyze issue.json --repo OWNER/REPO --comment
triagekit analyze issue.json --repo OWNER/REPO --comment --dry-run   # print instead
```

Re-running updates the previous triagekit comment instead of adding another.

## LLM refinement (optional)

```bash
ANTHROPIC_API_KEY=... triagekit analyze issue.json --llm
# or
OPENAI_API_KEY=... triagekit analyze issue.json --llm
```

Model override: `TRIAGEKIT_LLM_MODEL=claude-sonnet-4-5 triagekit analyze ... --llm`.
Without a key, `--llm` logs why it was skipped and the rule-based result is
used — nothing breaks.

## Try it on this repo's fixtures

```bash
triagekit analyze examples/fixtures/bug-report-missing-repro.json \
  --existing examples/fixtures/existing-issues.json
```
