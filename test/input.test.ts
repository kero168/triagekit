import { describe, expect, it } from 'vitest';
import { parseExistingIssues, parseIssueInput } from '../src/input.js';

describe('parseIssueInput', () => {
  it('accepts a raw issue object', () => {
    const { issue, repo } = parseIssueInput({ number: 1, title: 'Hello', body: 'World' });
    expect(issue.title).toBe('Hello');
    expect(repo).toBeUndefined();
  });

  it('unwraps a GitHub Actions issues event payload', () => {
    const { issue, repo } = parseIssueInput({
      action: 'opened',
      issue: { number: 7, title: 'From event', body: null },
      repository: { full_name: 'kero168/triagekit' },
    });
    expect(issue.number).toBe(7);
    expect(issue.title).toBe('From event');
    expect(repo).toBe('kero168/triagekit');
  });

  it('rejects non-objects', () => {
    expect(() => parseIssueInput([1, 2])).toThrow(/JSON object/);
    expect(() => parseIssueInput('nope')).toThrow(/JSON object/);
  });

  it('rejects objects that look like neither issue nor event', () => {
    expect(() => parseIssueInput({ foo: 'bar' })).toThrow(/neither an issue/);
  });
});

describe('parseExistingIssues', () => {
  it('keeps only valid {number, title} entries', () => {
    const issues = parseExistingIssues([
      { number: 1, title: 'ok', state: 'open' },
      { number: 'x', title: 'bad number' },
      { title: 'no number' },
      null,
      { number: 2, title: 'also ok', html_url: 'https://x/2' },
    ]);
    expect(issues.map((issue) => issue.number)).toEqual([1, 2]);
    expect(issues[1]!.html_url).toBe('https://x/2');
  });

  it('rejects non-arrays', () => {
    expect(() => parseExistingIssues({})).toThrow(/JSON array/);
  });
});
