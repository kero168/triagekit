/**
 * Rule-based label classification (bug / feature / docs / question).
 *
 * Each label has a set of weighted keyword/phrase rules. Rules matched in the
 * title count 1.5x, because titles are denser signals than bodies. The raw
 * score is squashed into a confidence in (0, 0.97] with score / (score + 1.4),
 * which is monotonic and keeps single weak matches humble.
 *
 * This is deliberately transparent: every suggestion carries the list of
 * matched signals so maintainers can see *why* a label was proposed. An LLM
 * can refine (never replace) these suggestions — see src/llm.ts.
 */
import type { Issue, LabelSuggestion, TriageLabel } from './types.js';

interface Rule {
  pattern: RegExp;
  weight: number;
  reason: string;
}

const TITLE_MULTIPLIER = 1.5;

/** Matches a typical Node.js / V8 stack frame like `    at fn (file.js:42:17)`. */
const STACK_FRAME = /^\s*at\s.+:\d+:\d+\)?\s*$/m;

const RULES: Record<TriageLabel, Rule[]> = {
  bug: [
    { pattern: /\bcrash(es|ed|ing)?\b/i, weight: 1.2, reason: 'mentions a crash' },
    { pattern: /\b(error|exception|traceback|stack ?trace)\b/i, weight: 1.0, reason: 'mentions an error or exception' },
    { pattern: /\b(fails?|failing|failure|broken|breaks?)\b/i, weight: 0.9, reason: 'mentions a failure or breakage' },
    { pattern: /\bregression\b/i, weight: 1.2, reason: 'mentions a regression' },
    { pattern: /\b(segfault|panic(s|ked)?|fatal|hangs?|freez(es|ing)?)\b/i, weight: 1.2, reason: 'mentions a hard failure or hang' },
    { pattern: /\b(unexpected(ly)?|wrong (output|result|behaviou?r))\b/i, weight: 0.7, reason: 'describes unexpected behavior' },
    { pattern: /(doesn'?t|does not|won'?t|will not|stopped|no longer) work/i, weight: 1.0, reason: 'says something does not work' },
    { pattern: /\b(TypeError|ReferenceError|SyntaxError|RangeError|ENOENT|EACCES|ECONNREFUSED|NullPointerException|undefined is not)\b/, weight: 1.3, reason: 'contains a concrete error name' },
    { pattern: /\bsteps to reproduce\b/i, weight: 0.8, reason: 'includes reproduction steps' },
  ],
  feature: [
    { pattern: /\bfeature request\b/i, weight: 1.5, reason: 'explicitly says "feature request"' },
    { pattern: /\benhancement\b/i, weight: 1.2, reason: 'mentions an enhancement' },
    { pattern: /\bwould be (nice|great|useful|helpful|awesome)\b/i, weight: 1.2, reason: 'uses "would be nice/great" phrasing' },
    { pattern: /\b(please )?add (support|an? (option|flag|command|setting)|the ability)\b/i, weight: 1.2, reason: 'asks to add support or an option' },
    { pattern: /\b(propos(e|es|al|ing)|suggest(s|ion|ing)?)\b/i, weight: 1.0, reason: 'proposes or suggests a change' },
    { pattern: /\b(implement|introduce|support for)\b/i, weight: 0.7, reason: 'asks to implement or introduce something' },
    { pattern: /\buse case\b/i, weight: 0.6, reason: 'describes a use case' },
  ],
  docs: [
    { pattern: /\b(docs?|documentation)\b/i, weight: 1.1, reason: 'mentions documentation' },
    { pattern: /\breadme\b/i, weight: 1.2, reason: 'mentions the README' },
    { pattern: /\btypo\b/i, weight: 1.3, reason: 'mentions a typo' },
    { pattern: /\b(outdated|incorrect|missing|unclear|misleading|broken) (docs?|documentation|example|guide|instructions|link)\b/i, weight: 1.4, reason: 'reports incorrect or outdated docs' },
    { pattern: /\b(guide|tutorial|changelog|docstring|jsdoc|api reference)\b/i, weight: 0.7, reason: 'mentions guides or reference material' },
  ],
  question: [
    { pattern: /\bhow (do|can|should|would) (i|we|you|one)\b/i, weight: 1.3, reason: 'asks "how do I..."' },
    { pattern: /\bhow to\b/i, weight: 1.0, reason: 'asks "how to..."' },
    { pattern: /\bis (it|there) (possible|a way)\b/i, weight: 1.2, reason: 'asks whether something is possible' },
    { pattern: /\b(question|clarif(y|ication))\b/i, weight: 1.1, reason: 'explicitly asks a question or clarification' },
    { pattern: /\bwhat('s| is) the (best|right|recommended|correct) way\b/i, weight: 1.2, reason: 'asks for the recommended way' },
    { pattern: /\bany way to\b/i, weight: 1.0, reason: 'asks for a way to do something' },
    { pattern: /\bam i (doing|missing|misunderstanding)\b/i, weight: 1.0, reason: 'asks whether they are doing it right' },
  ],
};

/** Squash a raw rule score into a confidence in (0, 0.97]. */
export function toConfidence(score: number): number {
  return Math.round(Math.min(0.97, score / (score + 1.4)) * 100) / 100;
}

/**
 * Classify an issue with keyword rules. Returns suggestions sorted by
 * confidence (highest first). Returns an empty array when no rule matches —
 * that is a signal for human triage, not a fake guess.
 */
export function classifyIssue(issue: Issue): LabelSuggestion[] {
  const title = issue.title ?? '';
  const body = issue.body ?? '';
  const suggestions: LabelSuggestion[] = [];

  for (const label of Object.keys(RULES) as TriageLabel[]) {
    let score = 0;
    const reasons: string[] = [];
    for (const rule of RULES[label]) {
      const inTitle = rule.pattern.test(title);
      const inBody = rule.pattern.test(body);
      if (!inTitle && !inBody) continue;
      score += rule.weight * (inTitle ? TITLE_MULTIPLIER : 1);
      reasons.push(inTitle ? `${rule.reason} (in title)` : rule.reason);
    }
    if (label === 'bug' && STACK_FRAME.test(body)) {
      score += 1.5;
      reasons.push('body contains a stack trace');
    }
    if (score > 0) {
      suggestions.push({ label, confidence: toConfidence(score), reasons, source: 'rules' });
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions;
}
