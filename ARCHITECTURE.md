# Architecture

triagekit is a small, deliberately boring pipeline. One entry point
(`analyzeIssue`) composes four independent, individually-tested modules.

```
                 ┌──────────────────────────────────────────────────┐
 issue JSON ──▶  │                 analyzeIssue()                   │ ──▶ AnalysisResult
 (file / stdin / │                                                  │        │
  event payload) │  similarity.ts   labeler.ts   repro.ts   llm.ts  │        ├─▶ format.ts ── pretty / json / comment
                 │  (duplicates)    (labels)     (checklist) (opt-in)│        └─▶ github.ts ── upsert issue comment
                 └──────────────────────────────────────────────────┘
```

## Modules

| Module | Responsibility | Key decision |
| --- | --- | --- |
| `src/similarity.ts` | Duplicate candidates | Character 3-gram Jaccard (robust to typos/inflection) averaged with token Jaccard over stopword-filtered tokens (robust to reordering). 100% local: no embeddings, no network, no model download. |
| `src/labeler.ts` | `bug`/`feature`/`docs`/`question` suggestion | Weighted regex rules; title matches count 1.5x; score squashed by `s/(s+1.4)` capped at 0.97. Every match records a `reason` — explainability is a hard requirement. Empty result = "needs human triage", never a fake guess. |
| `src/repro.ts` | Reproduction checklist | Four independent detectors (version, OS, steps, expected-vs-actual). Each missing field carries a reporter-facing `hint` used verbatim in the comment. `applicable: false` for non-bug issues — questions are not nagged for stack traces. |
| `src/llm.ts` | Opt-in refinement | Direct REST (`fetch`) against Anthropic Messages / OpenAI Chat Completions. Provider chosen by env var (`ANTHROPIC_API_KEY` wins). Returns a `LabelSuggestion` or `null`; transport errors throw and are caught by `analyze.ts`, which records them in `result.llm.error` and keeps the rule-based labels. |
| `src/analyze.ts` | Orchestration | Merges LLM output *into* rule output (agreeing label → max confidence + combined reasons) instead of replacing it. Decides checklist applicability from explicit labels + top suggestion. |
| `src/github.ts` | GitHub REST | Only two operations: list open issues (paginated, PRs filtered) and upsert the report comment. Upsert finds a previous comment via the hidden `<!-- triagekit:report -->` marker and PATCHes it — one comment per issue, ever. `apiUrl` honors `GITHUB_API_URL` for GHES. |
| `src/format.ts` | Rendering | `pretty` (terminal, colors only when TTY), `json` (the raw `AnalysisResult`), and the Markdown comment. |
| `src/input.ts` | Input parsing | Accepts either a raw REST issue object or a full `issues` event payload (unwraps `.issue`, extracts `repository.full_name`). |
| `src/cli.ts` | CLI | commander wiring only; all logic lives in the modules above so it is testable without spawning processes. |

## The `AnalysisResult` JSON contract

`--format json` emits exactly this structure (see `src/types.ts` for the
authoritative types):

```jsonc
{
  "issue": { "number": 102, "title": "..." },
  "duplicates": [ { "number": 12, "title": "...", "score": 0.85, "html_url": "..." } ],
  "labels": [ { "label": "bug", "confidence": 0.68, "reasons": ["..."], "source": "rules" } ],
  "repro": {
    "applicable": true,
    "fields": [ { "id": "version", "label": "...", "present": false, "hint": "..." } ],
    "missing": [ /* subset of fields */ ],
    "score": 0.25
  },
  "llm": { "requested": false, "used": false, "provider": null },
  "meta": { "existingIssuesScanned": 5, "threshold": 0.45, "version": "0.1.0" }
}
```

Until 1.0 this shape may gain fields in minor versions but existing fields
will not be renamed or removed without a changelog entry.

## Design principles

1. **Key-free first.** Every feature must have a useful no-API-key mode. The
   LLM refines, never gates.
2. **No SDKs.** Runtime deps are `commander` and `picocolors`. GitHub,
   Anthropic and OpenAI are called with the built-in `fetch`; `fetchImpl` is
   injectable everywhere, which is also how the tests mock the network.
3. **Explainable output.** Every label suggestion and duplicate candidate
   carries evidence a maintainer can check in seconds.
4. **Attacker-controlled input is text.** Issue titles/bodies are never
   evaluated, templated into shell commands, or echoed into HTML-sensitive
   contexts beyond Markdown.
5. **One comment per issue.** The Action must be re-runnable without spamming
   — hence the marker-based upsert.

## Action architecture

`action.yml` is a *composite* action: it sets up Node 20 and runs
`npx triagekit@<version>` with the event payload. This keeps the Action a
thin shim over the same CLI users run locally — one engine, one behavior,
and the Action automatically benefits from every CLI release without
rebuilding a Docker image or committing `dist/` bundles.

## Testing strategy

- **Unit**: each module in isolation (`test/similarity.test.ts`, etc.).
- **Integration**: `test/analyze.test.ts` runs the full pipeline over the
  fixture issues in `examples/fixtures/` — the same files shown in the README
  and executed by CI's smoke test.
- **Network**: GitHub and LLM clients are tested against mocked `fetch`
  implementations that assert on URLs, headers, and request bodies. The suite
  requires no key, no network, and finishes in seconds.
