/**
 * The analysis pipeline: duplicates → labels (rules, optionally LLM-refined)
 * → reproduction checklist. Pure orchestration; every step lives in its own
 * module and is unit-tested in isolation.
 */
import { classifyIssue } from './labeler.js';
import { classifyWithLlm, detectProvider } from './llm.js';
import { checkReproduction } from './repro.js';
import { findDuplicates } from './similarity.js';
import type {
  AnalysisResult,
  AnalyzeOptions,
  ExistingIssue,
  Issue,
  LabelSuggestion,
} from './types.js';
import { VERSION } from './version.js';

export const DEFAULT_THRESHOLD = 0.45;
export const DEFAULT_MAX_DUPLICATES = 3;

/** Normalize an issue's explicit labels to lowercase names. */
export function issueLabelNames(issue: Issue): string[] {
  return (issue.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : (label.name ?? '')))
    .filter((name) => name.length > 0)
    .map((name) => name.toLowerCase());
}

/**
 * Merge an LLM suggestion into the rule-based list. The LLM suggestion goes
 * first; when it agrees with a rule-based suggestion the two are merged
 * (max confidence, combined reasons) so no rationale is lost.
 */
export function mergeLabelSuggestions(
  ruleSuggestions: LabelSuggestion[],
  llmSuggestion: LabelSuggestion,
): LabelSuggestion[] {
  const merged: LabelSuggestion[] = [];
  const agreeing = ruleSuggestions.find((item) => item.label === llmSuggestion.label);
  if (agreeing) {
    merged.push({
      label: llmSuggestion.label,
      confidence: Math.max(llmSuggestion.confidence, agreeing.confidence),
      reasons: [...llmSuggestion.reasons, ...agreeing.reasons],
      source: 'llm',
    });
  } else {
    merged.push(llmSuggestion);
  }
  for (const item of ruleSuggestions) {
    if (item.label !== llmSuggestion.label) merged.push(item);
  }
  return merged;
}

/**
 * Analyze one issue against a set of existing issues.
 *
 * Fully offline by default. When `options.llm` is true and an API key is
 * present in `options.env` (default `process.env`), the label suggestion is
 * refined by the LLM; any LLM failure falls back to the rule-based result and
 * is reported in `result.llm.error` instead of crashing the run.
 */
export async function analyzeIssue(
  issue: Issue,
  existing: ExistingIssue[] = [],
  options: AnalyzeOptions = {},
): Promise<AnalysisResult> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const maxDuplicates = options.maxDuplicates ?? DEFAULT_MAX_DUPLICATES;
  const env = options.env ?? process.env;

  const duplicates = findDuplicates(issue, existing, { threshold, limit: maxDuplicates });
  let labels = classifyIssue(issue);

  const llm: AnalysisResult['llm'] = {
    requested: options.llm === true,
    used: false,
    provider: null,
  };
  if (options.llm === true) {
    const provider = detectProvider(env);
    llm.provider = provider;
    if (!provider) {
      llm.error =
        'no API key found — set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable LLM refinement';
    } else {
      try {
        const suggestion = await classifyWithLlm(issue, { env, fetchImpl: options.fetchImpl });
        if (suggestion) {
          labels = mergeLabelSuggestions(labels, suggestion);
          llm.used = true;
        } else {
          llm.error = 'LLM response could not be parsed — using rule-based labels';
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        llm.error = `${message} — using rule-based labels`;
      }
    }
  }

  const explicitLabels = issueLabelNames(issue);
  const topLabel = labels[0]?.label;
  const bugLike =
    explicitLabels.includes('bug') || topLabel === 'bug' || labels.length === 0;
  const repro = checkReproduction(issue, { applicable: bugLike });

  return {
    issue: { number: issue.number, title: issue.title },
    duplicates,
    labels,
    repro,
    llm,
    meta: {
      existingIssuesScanned: existing.filter((item) => item.number !== issue.number).length,
      threshold,
      version: VERSION,
    },
  };
}
