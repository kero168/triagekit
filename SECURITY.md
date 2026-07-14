# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | ✅ |
| < 0.1 | ❌ |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting:
<https://github.com/kero168/triagekit/security/advisories/new>

You can expect:

- **Acknowledgement within 72 hours.**
- A fix or mitigation plan within 14 days for confirmed issues.
- Credit in the release notes (unless you prefer otherwise).
- Coordinated disclosure: we ask for up to 90 days before public details.

## Scope notes

Things especially worth reporting:

- The GitHub Action executing untrusted issue content in a dangerous way
  (issue titles/bodies are attacker-controlled input by design — the analyzer
  must treat them as text only, never evaluate them).
- Token leakage: `github-token`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
  appearing in logs, comments, or error messages.
- Comment upsert being abusable to overwrite someone else's comment.

## Hardening notes for users

- Run the Action with the minimal permissions shown in the docs
  (`permissions: issues: write`; `contents: read` is not needed).
- LLM keys are optional. If you enable them, pass them as encrypted secrets
  via the step `env`, never as inputs.
- Pin the Action to a tag (`@v0`) or a commit SHA if your policy requires it.
