/**
 * Integration tests: run the full pipeline over the fixture issues in
 * examples/fixtures/ — the same files used in the README and CI smoke test.
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { analyzeIssue, mergeLabelSuggestions } from '../src/analyze.js';
import { parseExistingIssues, parseIssueInput } from '../src/input.js';
import type { ExistingIssue, Issue } from '../src/types.js';

async function fixture(name: string): Promise<unknown> {
  const url = new URL(`../examples/fixtures/${name}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

async function fixtureIssue(name: string): Promise<Issue> {
  return parseIssueInput(await fixture(name)).issue;
}

async function existingIssues(): Promise<ExistingIssue[]> {
  return parseExistingIssues(await fixture('existing-issues.json'));
}

describe('analyzeIssue on fixtures (integration)', () => {
  it('flags the complete bug report as bug, finds its duplicate, passes the checklist', async () => {
    const result = await analyzeIssue(
      await fixtureIssue('bug-report-complete.json'),
      await existingIssues(),
    );
    expect(result.labels[0]!.label).toBe('bug');
    expect(result.labels[0]!.confidence).toBeGreaterThan(0.6);
    expect(result.duplicates[0]!.number).toBe(12);
    expect(result.duplicates[0]!.score).toBeGreaterThan(0.6);
    expect(result.repro.applicable).toBe(true);
    expect(result.repro.missing).toEqual([]);
    expect(result.repro.score).toBe(1);
    expect(result.llm.requested).toBe(false);
  });

  it('flags the vague bug report as bug with the full checklist missing', async () => {
    const result = await analyzeIssue(
      await fixtureIssue('bug-report-missing-repro.json'),
      await existingIssues(),
    );
    expect(result.labels[0]!.label).toBe('bug');
    expect(result.repro.applicable).toBe(true);
    expect(result.repro.missing.map((field) => field.id)).toEqual([
      'version',
      'os',
      'steps',
      'expected-actual',
    ]);
  });

  it('classifies the feature request and finds the related issue at a lower threshold', async () => {
    const result = await analyzeIssue(
      await fixtureIssue('feature-request.json'),
      await existingIssues(),
      { threshold: 0.2 },
    );
    expect(result.labels[0]!.label).toBe('feature');
    expect(result.duplicates.map((candidate) => candidate.number)).toContain(55);
    expect(result.repro.applicable).toBe(false);
  });

  it('classifies the usage question as question and skips the repro demand', async () => {
    const result = await analyzeIssue(
      await fixtureIssue('question-usage.json'),
      await existingIssues(),
    );
    expect(result.labels[0]!.label).toBe('question');
    expect(result.repro.applicable).toBe(false);
  });

  it('classifies the typo report as docs', async () => {
    const result = await analyzeIssue(await fixtureIssue('docs-typo.json'), await existingIssues());
    expect(result.labels[0]!.label).toBe('docs');
  });

  it('unwraps the Actions event payload fixture', async () => {
    const { issue, repo } = parseIssueInput(await fixture('issues-opened-event.json'));
    expect(repo).toBe('kero168/triagekit-demo');
    const result = await analyzeIssue(issue, await existingIssues());
    expect(result.issue.number).toBe(7);
    expect(result.labels[0]!.label).toBe('bug');
  });

  it('reports metadata about the scan', async () => {
    const existing = await existingIssues();
    const result = await analyzeIssue(await fixtureIssue('bug-report-complete.json'), existing, {
      threshold: 0.5,
      maxDuplicates: 2,
    });
    expect(result.meta.existingIssuesScanned).toBe(existing.length);
    expect(result.meta.threshold).toBe(0.5);
    expect(result.duplicates.length).toBeLessThanOrEqual(2);
  });
});

describe('analyzeIssue with LLM refinement', () => {
  const issue: Issue = { number: 1, title: 'App crashes on save', body: 'boom' };

  it('merges the LLM suggestion in front when a key is configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: '{"label":"bug","confidence":0.95,"reason":"clear crash"}' }],
      }),
      text: async () => '',
    } as unknown as Response);
    const result = await analyzeIssue(issue, [], {
      llm: true,
      env: { ANTHROPIC_API_KEY: 'test' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.llm).toMatchObject({ requested: true, used: true, provider: 'anthropic' });
    expect(result.labels[0]!.source).toBe('llm');
    expect(result.labels[0]!.confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.labels[0]!.reasons).toContain('clear crash');
  });

  it('records an error and keeps rule labels when no key is present', async () => {
    const result = await analyzeIssue(issue, [], { llm: true, env: {} });
    expect(result.llm.used).toBe(false);
    expect(result.llm.error).toMatch(/no API key/i);
    expect(result.labels[0]!.source).toBe('rules');
  });

  it('survives an LLM transport failure gracefully', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await analyzeIssue(issue, [], {
      llm: true,
      env: { OPENAI_API_KEY: 'k' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.llm.used).toBe(false);
    expect(result.llm.error).toContain('network down');
    expect(result.labels[0]!.label).toBe('bug');
  });

  it('does not touch the network when llm is not requested', async () => {
    const fetchImpl = vi.fn();
    const result = await analyzeIssue(issue, [], {
      env: { ANTHROPIC_API_KEY: 'k' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.llm.requested).toBe(false);
  });
});

describe('mergeLabelSuggestions', () => {
  it('merges agreeing suggestions with max confidence and combined reasons', () => {
    const merged = mergeLabelSuggestions(
      [{ label: 'bug', confidence: 0.6, reasons: ['keyword'], source: 'rules' }],
      { label: 'bug', confidence: 0.9, reasons: ['llm says so'], source: 'llm' },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ label: 'bug', confidence: 0.9, source: 'llm' });
    expect(merged[0]!.reasons).toEqual(['llm says so', 'keyword']);
  });

  it('puts a disagreeing LLM suggestion first and keeps the rules', () => {
    const merged = mergeLabelSuggestions(
      [{ label: 'question', confidence: 0.5, reasons: ['how to'], source: 'rules' }],
      { label: 'docs', confidence: 0.8, reasons: ['docs gap'], source: 'llm' },
    );
    expect(merged.map((suggestion) => suggestion.label)).toEqual(['docs', 'question']);
  });
});
