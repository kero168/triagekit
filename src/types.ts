/**
 * Shared types for triagekit.
 *
 * The `Issue` shape intentionally matches both the GitHub REST API
 * (`GET /repos/{owner}/{repo}/issues/{number}`) and the `issue` object found
 * inside an `issues` webhook / Actions event payload, so either can be fed to
 * the analyzer without transformation.
 */

/** A GitHub issue, as returned by the REST API or found in an event payload. */
export interface Issue {
  number?: number;
  title: string;
  body?: string | null;
  labels?: Array<string | { name?: string }>;
  html_url?: string;
  user?: { login?: string };
}

/** A lightweight view of an existing issue, used for duplicate detection. */
export interface ExistingIssue {
  number: number;
  title: string;
  state?: string;
  html_url?: string;
}

/** An existing issue that looks similar to the analyzed one. */
export interface DuplicateCandidate {
  number: number;
  title: string;
  /** Combined similarity score in [0, 1] (see src/similarity.ts). */
  score: number;
  html_url?: string;
}

/** The label taxonomy triagekit classifies into. */
export type TriageLabel = 'bug' | 'feature' | 'docs' | 'question';

export const TRIAGE_LABELS: readonly TriageLabel[] = ['bug', 'feature', 'docs', 'question'];

/** A suggested label with an explanation of why it was suggested. */
export interface LabelSuggestion {
  label: TriageLabel;
  /** Heuristic confidence in [0, 1]. Not a calibrated probability. */
  confidence: number;
  /** Human-readable reasons (matched signals or the LLM's rationale). */
  reasons: string[];
  /** Where the suggestion came from. */
  source: 'rules' | 'llm';
}

/** One element of the reproduction checklist. */
export interface ReproField {
  id: 'version' | 'os' | 'steps' | 'expected-actual';
  label: string;
  present: boolean;
  /** Short snippet of the text that satisfied the check (when present). */
  evidence?: string;
  /** What to ask the reporter for (when missing). */
  hint: string;
}

/** Result of the reproduction-information check. */
export interface ReproReport {
  /** False when the issue does not look like a bug report (informational only). */
  applicable: boolean;
  fields: ReproField[];
  missing: ReproField[];
  /** Fraction of checklist items present, in [0, 1]. */
  score: number;
}

/** The complete result of analyzing one issue. */
export interface AnalysisResult {
  issue: { number?: number; title: string };
  duplicates: DuplicateCandidate[];
  labels: LabelSuggestion[];
  repro: ReproReport;
  llm: {
    requested: boolean;
    used: boolean;
    provider: string | null;
    error?: string;
  };
  meta: {
    existingIssuesScanned: number;
    threshold: number;
    version: string;
  };
}

/** Options accepted by `analyzeIssue`. */
export interface AnalyzeOptions {
  /** Similarity threshold for duplicate candidates (default 0.45). */
  threshold?: number;
  /** Maximum number of duplicate candidates to report (default 3). */
  maxDuplicates?: number;
  /** Opt in to LLM label refinement (default false; requires an API key). */
  llm?: boolean;
  /** Environment to read API keys from (default `process.env`). */
  env?: Record<string, string | undefined>;
  /** fetch implementation, injectable for tests (default global `fetch`). */
  fetchImpl?: typeof fetch;
}
