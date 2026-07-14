import { describe, expect, it, vi } from 'vitest';
import {
  buildPrompt,
  classifyWithLlm,
  detectProvider,
  parseLlmLabel,
} from '../src/llm.js';

function jsonResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

describe('detectProvider', () => {
  it('prefers anthropic when both keys are set', () => {
    expect(detectProvider({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'b' })).toBe('anthropic');
  });

  it('falls back to openai', () => {
    expect(detectProvider({ OPENAI_API_KEY: 'b' })).toBe('openai');
  });

  it('returns null with no keys', () => {
    expect(detectProvider({})).toBeNull();
  });
});

describe('buildPrompt', () => {
  it('includes the title and truncates the body', () => {
    const prompt = buildPrompt({ title: 'My title', body: 'x'.repeat(5000) }, 100);
    expect(prompt).toContain('My title');
    expect(prompt).not.toContain('x'.repeat(101));
  });

  it('marks an empty body', () => {
    expect(buildPrompt({ title: 't', body: null })).toContain('(empty)');
  });
});

describe('parseLlmLabel', () => {
  it('parses a clean JSON reply', () => {
    const result = parseLlmLabel('{"label":"bug","confidence":0.9,"reason":"stack trace"}');
    expect(result).toEqual({
      label: 'bug',
      confidence: 0.9,
      reasons: ['stack trace'],
      source: 'llm',
    });
  });

  it('extracts JSON embedded in prose', () => {
    const result = parseLlmLabel('Sure! Here it is: {"label":"docs","confidence":0.7,"reason":"typo"} Hope that helps.');
    expect(result!.label).toBe('docs');
  });

  it('rejects labels outside the taxonomy', () => {
    expect(parseLlmLabel('{"label":"wontfix","confidence":0.9,"reason":"x"}')).toBeNull();
  });

  it('clamps confidence into [0, 1]', () => {
    expect(parseLlmLabel('{"label":"bug","confidence":7,"reason":"x"}')!.confidence).toBe(1);
    expect(parseLlmLabel('{"label":"bug","confidence":-2,"reason":"x"}')!.confidence).toBe(0);
  });

  it('returns null for garbage', () => {
    expect(parseLlmLabel('no json here')).toBeNull();
    expect(parseLlmLabel('{broken json')).toBeNull();
  });
});

describe('classifyWithLlm', () => {
  const issue = { title: 'App crashes on save', body: 'boom' };

  it('returns null without calling fetch when no key is configured', async () => {
    const fetchImpl = vi.fn();
    const result = await classifyWithLlm(issue, {
      env: {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('calls the Anthropic Messages API and parses the reply', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: '{"label":"bug","confidence":0.92,"reason":"crash"}' }],
      }),
    );
    const result = await classifyWithLlm(issue, {
      env: { ANTHROPIC_API_KEY: 'test-key' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result!.label).toBe('bug');
    expect(result!.source).toBe('llm');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-key');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init.body);
    expect(body.messages[0].content).toContain('App crashes on save');
  });

  it('calls the OpenAI Chat Completions API and parses the reply', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: '{"label":"feature","confidence":0.8,"reason":"asks for support"}' } }],
      }),
    );
    const result = await classifyWithLlm(issue, {
      env: { OPENAI_API_KEY: 'sk-test' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result!.label).toBe('feature');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer sk-test');
  });

  it('throws a descriptive error on HTTP failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, false, 429));
    await expect(
      classifyWithLlm(issue, {
        env: { ANTHROPIC_API_KEY: 'k' },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/429/);
  });

  it('honors a model override', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: '{"label":"bug","confidence":1,"reason":"r"}' }] }),
    );
    await classifyWithLlm(issue, {
      env: { ANTHROPIC_API_KEY: 'k' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      model: 'claude-test-model',
    });
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(JSON.parse(init.body).model).toBe('claude-test-model');
  });
});
