/**
 * Optional LLM label refinement.
 *
 * Strictly opt-in (`--llm` / `llm: true`). Providers are auto-detected from
 * environment variables — ANTHROPIC_API_KEY first, then OPENAI_API_KEY — and
 * called directly over REST with the built-in `fetch`, so triagekit carries no
 * SDK dependencies. When no key is set, or the call fails, triagekit degrades
 * gracefully to its rule-based classification.
 *
 * The `fetchImpl` parameter exists so tests can mock the network; the test
 * suite never needs a real API key.
 */
import type { Issue, LabelSuggestion, TriageLabel } from './types.js';
import { TRIAGE_LABELS } from './types.js';
import { VERSION } from './version.js';

export type LlmProviderName = 'anthropic' | 'openai';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-haiku-latest';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export interface LlmOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  /** Override the model (also settable via TRIAGEKIT_LLM_MODEL). */
  model?: string;
  /** Truncate the issue body to this many characters (default 4000). */
  maxBodyChars?: number;
}

/** Pick a provider from the environment. Anthropic wins if both keys are set. */
export function detectProvider(
  env: Record<string, string | undefined> = process.env,
): LlmProviderName | null {
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.OPENAI_API_KEY) return 'openai';
  return null;
}

/** Build the classification prompt sent to either provider. */
export function buildPrompt(issue: Issue, maxBodyChars = 4000): string {
  const body = (issue.body ?? '').slice(0, maxBodyChars);
  return [
    'You are an issue triage assistant for an open source project.',
    'Classify the GitHub issue below into exactly one of these labels: bug, feature, docs, question.',
    'Respond with ONLY a JSON object of the shape',
    '{"label": "<label>", "confidence": <number between 0 and 1>, "reason": "<one short sentence>"}',
    'and nothing else.',
    '',
    `Issue title: ${issue.title}`,
    'Issue body:',
    body.length > 0 ? body : '(empty)',
  ].join('\n');
}

/**
 * Parse the model's reply into a LabelSuggestion. Tolerates prose around the
 * JSON object. Returns null when the reply cannot be interpreted safely.
 */
export function parseLlmLabel(text: string): LabelSuggestion | null {
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const label = typeof record.label === 'string' ? record.label.toLowerCase().trim() : '';
  if (!(TRIAGE_LABELS as readonly string[]).includes(label)) return null;
  const rawConfidence = typeof record.confidence === 'number' ? record.confidence : 0.5;
  const confidence = Math.round(Math.min(1, Math.max(0, rawConfidence)) * 100) / 100;
  const reason =
    typeof record.reason === 'string' && record.reason.trim().length > 0
      ? record.reason.trim()
      : 'LLM classification';
  return { label: label as TriageLabel, confidence, reasons: [reason], source: 'llm' };
}

async function callAnthropic(
  prompt: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  model?: string,
): Promise<string> {
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'user-agent': `triagekit/${VERSION}`,
    },
    body: JSON.stringify({
      model: model ?? env.TRIAGEKIT_LLM_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`Anthropic API returned ${response.status}: ${detail}`);
  }
  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const part = data.content?.find((item) => typeof item.text === 'string');
  if (!part?.text) throw new Error('Anthropic API returned no text content');
  return part.text;
}

async function callOpenAi(
  prompt: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  model?: string,
): Promise<string> {
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY ?? ''}`,
      'user-agent': `triagekit/${VERSION}`,
    },
    body: JSON.stringify({
      model: model ?? env.TRIAGEKIT_LLM_MODEL ?? DEFAULT_OPENAI_MODEL,
      temperature: 0,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`OpenAI API returned ${response.status}: ${detail}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI API returned no message content');
  return content;
}

/**
 * Classify an issue with the configured LLM provider.
 *
 * Returns null when no provider is configured or the reply cannot be parsed.
 * Throws on transport/HTTP errors so callers can surface (and survive) them.
 */
export async function classifyWithLlm(
  issue: Issue,
  options: LlmOptions = {},
): Promise<LabelSuggestion | null> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const provider = detectProvider(env);
  if (!provider) return null;
  const prompt = buildPrompt(issue, options.maxBodyChars);
  const text =
    provider === 'anthropic'
      ? await callAnthropic(prompt, env, fetchImpl, options.model)
      : await callOpenAi(prompt, env, fetchImpl, options.model);
  return parseLlmLabel(text);
}
