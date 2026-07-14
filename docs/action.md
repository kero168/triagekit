# GitHub Action guide

triagekit ships as a composite Action that runs the same CLI you can use
locally. On `issues: opened` it analyzes the new issue and posts one comment
with the suggested label, duplicate candidates, and missing reproduction
info. Re-runs update that same comment.

## Minimal setup

`.github/workflows/triage.yml`:

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
```

No checkout, no build, no secrets beyond the automatic token.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `${{ github.token }}` | Token for reading open issues and commenting. Needs `issues: write`. |
| `dry-run` | `'false'` | `'true'` prints the report + would-be comment to the log instead of commenting. Great for evaluating triagekit on a busy repo before letting it speak. |
| `llm` | `'false'` | `'true'` enables LLM label refinement. Provide a key via the step `env` (below). |
| `threshold` | `'0.45'` | Similarity floor (0..1) for duplicate candidates. Lower = more candidates. |
| `max-duplicates` | `'3'` | Max duplicate candidates listed in the comment. |
| `version` | `'latest'` | npm version/dist-tag of the triagekit CLI to run. Pin (e.g. `'0.1.0'`) for fully reproducible behavior. |

## Recipes

### Trial mode (no comments posted)

```yaml
- uses: kero168/triagekit@v0
  with:
    dry-run: 'true'
```

### With LLM refinement

```yaml
- uses: kero168/triagekit@v0
  with:
    llm: 'true'
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}   # or OPENAI_API_KEY
```

Keys go in `env`, never in `with:` — they are secrets, not configuration.

### Stricter duplicate matching, pinned CLI

```yaml
- uses: kero168/triagekit@v0
  with:
    threshold: '0.6'
    max-duplicates: '5'
    version: '0.1.0'
```

### Also run on reopened/edited issues

```yaml
on:
  issues:
    types: [opened, reopened, edited]
```

Because comments are upserted, running on `edited` gives reporters live
feedback as they fill in missing reproduction info.

## Permissions & security notes

- The workflow needs only `permissions: issues: write`. Do not grant more.
- Issue titles and bodies are attacker-controlled. triagekit treats them as
  plain text: they are never executed, and the Action passes them to the CLI
  only via the event payload file, never through shell interpolation.
- Pin to a major tag (`@v0`) or a commit SHA per your security policy.
- On GitHub Enterprise Server, `GITHUB_API_URL` is honored automatically.

## What the comment looks like

```markdown
### triagekit report

**Suggested label:** `bug` (confidence 0.73) — mentions a crash (in title); ...

**Possible duplicates:**
- #12 — CLI crashes with TypeError when config is empty (similarity 0.85)

**Reproduction info missing** — to help maintainers reproduce this, please edit the issue and add:
- [ ] **Version information** — State the exact version of this project ...
- [ ] **Operating system / environment** — ...
```
