/**
 * triagekit — AI-powered issue triage for GitHub.
 * Public programmatic API. See the CLI (src/cli.ts) for the command-line
 * interface and action.yml for the GitHub Action.
 */
export {
  analyzeIssue,
  DEFAULT_MAX_DUPLICATES,
  DEFAULT_THRESHOLD,
  issueLabelNames,
  mergeLabelSuggestions,
} from './analyze.js';
export { formatComment, formatJson, formatPretty } from './format.js';
export type { FormatOptions } from './format.js';
export {
  COMMENT_MARKER,
  DEFAULT_API_URL,
  fetchOpenIssues,
  upsertIssueComment,
} from './github.js';
export type {
  FetchOpenIssuesOptions,
  GithubOptions,
  UpsertCommentOptions,
  UpsertCommentResult,
} from './github.js';
export {
  loadExistingIssuesFile,
  loadIssueFile,
  parseExistingIssues,
  parseIssueInput,
} from './input.js';
export type { LoadedIssue } from './input.js';
export { classifyIssue, toConfidence } from './labeler.js';
export {
  buildPrompt,
  classifyWithLlm,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_MODEL,
  detectProvider,
  parseLlmLabel,
} from './llm.js';
export type { LlmOptions, LlmProviderName } from './llm.js';
export { checkReproduction } from './repro.js';
export type { CheckReproductionOptions } from './repro.js';
export {
  charNgrams,
  findDuplicates,
  jaccard,
  normalizeText,
  titleSimilarity,
  tokenize,
} from './similarity.js';
export type { FindDuplicatesOptions } from './similarity.js';
export type {
  AnalysisResult,
  AnalyzeOptions,
  DuplicateCandidate,
  ExistingIssue,
  Issue,
  LabelSuggestion,
  ReproField,
  ReproReport,
  TriageLabel,
} from './types.js';
export { TRIAGE_LABELS } from './types.js';
export { VERSION } from './version.js';
