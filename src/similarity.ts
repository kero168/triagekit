/**
 * Local, dependency-free title similarity.
 *
 * Duplicate detection combines two set-similarity signals over issue titles:
 *
 * 1. Character 3-gram Jaccard — robust to small edits, typos and inflection.
 * 2. Token Jaccard (stopwords removed) — robust to word reordering.
 *
 * The final score is the mean of the two, in [0, 1]. This runs entirely
 * locally: no network, no API key, no model download.
 */
import type { DuplicateCandidate, ExistingIssue, Issue } from './types.js';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'for', 'with', 'and', 'or', 'not', 'no',
  'when', 'while', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'we', 'you', 'my', 'our', 'your', 'me', 'us',
  'do', 'does', 'did', 'doesn', 'don', 'can', 'cannot', 'cant',
  'could', 'should', 'would', 'will', 'wont', 'won',
  'at', 'as', 'by', 'from', 'has', 'have', 'had', 'but', 'if', 'into',
  'about', 'over', 'under', 'again', 'then', 'than', 'there', 'here',
  'what', 'which', 'who', 'whom', 'why', 'how',
  'all', 'any', 'both', 'each', 'some', 'such', 'only', 'own', 'same',
  's', 't', 'just', 'now', 'via', 'using',
]);

/** Lowercase, strip punctuation/backticks, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/`+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into meaningful tokens: stopwords and single characters removed. */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[\s.-]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/** Set of character n-grams (default n = 3) over the normalized text. */
export function charNgrams(text: string, n = 3): Set<string> {
  const normalized = normalizeText(text);
  const grams = new Set<string>();
  if (normalized.length === 0) return grams;
  if (normalized.length < n) {
    grams.add(normalized);
    return grams;
  }
  for (let i = 0; i <= normalized.length - n; i++) {
    grams.add(normalized.slice(i, i + n));
  }
  return grams;
}

/** Jaccard similarity |A ∩ B| / |A ∪ B|. Empty ∪ empty is defined as 0. */
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Combined similarity of two titles: mean of 3-gram and token Jaccard. */
export function titleSimilarity(a: string, b: string): number {
  const ngramScore = jaccard(charNgrams(a), charNgrams(b));
  const tokenScore = jaccard(new Set(tokenize(a)), new Set(tokenize(b)));
  return 0.5 * ngramScore + 0.5 * tokenScore;
}

export interface FindDuplicatesOptions {
  /** Minimum score to report a candidate (default 0.45). */
  threshold?: number;
  /** Maximum number of candidates to return (default 3). */
  limit?: number;
}

/**
 * Rank existing issues by title similarity to `issue` and return the ones at
 * or above the threshold, best first. The issue itself (same `number`) is
 * excluded.
 */
export function findDuplicates(
  issue: Issue,
  existing: ExistingIssue[],
  options: FindDuplicatesOptions = {},
): DuplicateCandidate[] {
  const threshold = options.threshold ?? 0.45;
  const limit = options.limit ?? 3;
  return existing
    .filter((candidate) => candidate.number !== issue.number)
    .map((candidate): DuplicateCandidate => ({
      number: candidate.number,
      title: candidate.title,
      html_url: candidate.html_url,
      score: Math.round(titleSimilarity(issue.title, candidate.title) * 1000) / 1000,
    }))
    .filter((candidate) => candidate.score >= threshold)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
