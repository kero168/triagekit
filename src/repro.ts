/**
 * Reproduction-information checklist.
 *
 * A bug report a maintainer can act on needs four things:
 *
 *   1. version     — which release of the project (and runtime) is affected
 *   2. os          — the operating system / environment
 *   3. steps       — exact commands or numbered steps to reproduce
 *   4. expected vs actual — what should have happened vs what happened
 *
 * `checkReproduction` detects each element with regex heuristics and reports
 * what is present (with evidence) and what is missing (with a hint the
 * reporter can act on). It never blocks anything — it only asks.
 */
import type { Issue, ReproField, ReproReport } from './types.js';

interface CheckDefinition {
  id: ReproField['id'];
  label: string;
  hint: string;
  detect: (text: string) => string | null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[0].trim().length > 0) {
      return match[0].trim().replace(/\s+/g, ' ').slice(0, 80);
    }
  }
  return null;
}

const CHECKS: CheckDefinition[] = [
  {
    id: 'version',
    label: 'Version information',
    hint: 'State the exact version of this project (and your runtime, e.g. Node.js) where the problem occurs.',
    detect: (text) =>
      firstMatch(text, [
        /\bv?\d+\.\d+\.\d+(?:-[\w.]+)?\b/,
        /\bversion[:=]?\s*\S+/i,
        /\bnode(?:\.?js)?\s+v?\d+/i,
      ]),
  },
  {
    id: 'os',
    label: 'Operating system / environment',
    hint: 'Mention your OS or environment (e.g. macOS 14, Ubuntu 24.04, Windows 11, Docker, GitHub Actions runner).',
    detect: (text) =>
      firstMatch(text, [
        /\b(windows|win32|win64|macos|mac os|osx|os x|darwin|linux|ubuntu|debian|fedora|arch linux|alpine|centos|nixos|wsl2?|docker|container|github actions)\b[^\n]{0,24}/i,
      ]),
  },
  {
    id: 'steps',
    label: 'Steps to reproduce',
    hint: 'List the exact commands or numbered steps that trigger the problem, ideally in a code block.',
    detect: (text) =>
      firstMatch(text, [
        /steps to reproduce/i,
        /\brepro(?:duction)? steps\b/i,
        /^\s*\d+[.)]\s+\S+/m,
        /```[\s\S]*?```/,
        /\b(?:npx|npm|pnpm|yarn|node|deno|bun|git|curl)\s+[\w@./-]+/,
      ]),
  },
  {
    id: 'expected-actual',
    label: 'Expected vs actual behavior',
    hint: 'Describe what you expected to happen and what actually happened instead.',
    detect: (text) => {
      const expected = text.match(/\bexpect(?:ed|s|ing)?\b/i);
      const actual = text.match(/\b(actual(?:ly)?|instead|however|but it|got)\b/i);
      if (expected && actual) return `"${expected[0]}" + "${actual[0]}"`;
      return null;
    },
  },
];

export interface CheckReproductionOptions {
  /**
   * Whether the checklist applies to this issue. Feature requests and
   * questions do not need reproduction steps; callers (see analyzeIssue) set
   * this based on the classification. Defaults to true.
   */
  applicable?: boolean;
}

/** Run the four-element reproduction checklist over an issue's title + body. */
export function checkReproduction(
  issue: Issue,
  options: CheckReproductionOptions = {},
): ReproReport {
  const text = `${issue.title ?? ''}\n${issue.body ?? ''}`;
  const fields: ReproField[] = CHECKS.map((check) => {
    const evidence = check.detect(text);
    return {
      id: check.id,
      label: check.label,
      present: evidence !== null,
      evidence: evidence ?? undefined,
      hint: check.hint,
    };
  });
  const missing = fields.filter((field) => !field.present);
  return {
    applicable: options.applicable ?? true,
    fields,
    missing,
    score: Math.round(((fields.length - missing.length) / fields.length) * 100) / 100,
  };
}
