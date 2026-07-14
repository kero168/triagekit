import { describe, expect, it } from 'vitest';
import { analyzeIssue } from '../src/analyze.js';
import { formatComment, formatJson, formatPretty } from '../src/format.js';
import { COMMENT_MARKER } from '../src/github.js';

const existing = [{ number: 12, title: 'CLI crashes with TypeError when config is empty' }];

async function sampleResult() {
  return analyzeIssue(
    {
      number: 101,
      title: 'CLI crashes with TypeError when config file is empty',
      body: 'It just crashes.',
    },
    existing,
  );
}

describe('formatJson', () => {
  it('round-trips through JSON.parse', async () => {
    const result = await sampleResult();
    const parsed = JSON.parse(formatJson(result));
    expect(parsed.issue.number).toBe(101);
    expect(parsed.labels[0].label).toBe('bug');
  });
});

describe('formatPretty', () => {
  it('renders labels, duplicates and the checklist without ANSI codes by default', async () => {
    const output = formatPretty(await sampleResult());
    expect(output).toContain('Suggested labels');
    expect(output).toContain('bug');
    expect(output).toContain('#12');
    expect(output).toContain('Reproduction checklist');
    // eslint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\[/);
  });

  it('says when no duplicates were found', async () => {
    const result = await analyzeIssue({ title: 'Totally unique topic', body: '' }, existing);
    expect(formatPretty(result)).toContain('none found');
  });
});

describe('formatComment', () => {
  it('contains the hidden marker for idempotent updates', async () => {
    expect(formatComment(await sampleResult())).toContain(COMMENT_MARKER);
  });

  it('lists missing reproduction info as a checklist', async () => {
    const comment = formatComment(await sampleResult());
    expect(comment).toContain('Reproduction info missing');
    expect(comment).toContain('- [ ] **Version information**');
  });

  it('lists duplicate candidates with scores', async () => {
    const comment = formatComment(await sampleResult());
    expect(comment).toMatch(/#12 — CLI crashes with TypeError when config is empty \(similarity 0\.\d+\)/);
  });

  it('thanks the reporter when the report is complete', async () => {
    const result = await analyzeIssue(
      {
        title: 'Crash on save',
        body: '1. run `npm start`\n2. save\nExpected: saved. Actual: crash instead.\ntriagekit 0.1.0, Node v20, Ubuntu 24.04',
      },
      [],
    );
    expect(formatComment(result)).toContain('thank you!');
  });
});
