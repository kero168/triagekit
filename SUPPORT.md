# Support

## Where to ask

| Need | Place |
| --- | --- |
| Usage question, "how do I..." | [GitHub Discussions](https://github.com/kero168/triagekit/discussions) |
| Bug report | [New issue](https://github.com/kero168/triagekit/issues/new/choose) — the bug template asks for exactly what triagekit's own checklist checks |
| Feature idea | [New issue](https://github.com/kero168/triagekit/issues/new/choose) (feature template) |
| Security problem | [Private advisory](https://github.com/kero168/triagekit/security/advisories/new) — see [SECURITY.md](SECURITY.md) |

## Before filing a bug

1. Reproduce with the latest release: `npx triagekit@latest --version`.
2. Run with `--format json` and attach the output — it contains everything
   the analyzer saw.
3. If the problem involves a specific issue's text, attach the issue JSON
   (`gh api repos/OWNER/REPO/issues/N > issue.json`), redacted as needed.

## Response expectations

This is a volunteer-maintained project. Issues are usually looked at within a
week; PRs with tests get priority. Being kind gets you everywhere.
