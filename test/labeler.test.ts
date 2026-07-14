import { describe, expect, it } from 'vitest';
import { classifyIssue, toConfidence } from '../src/labeler.js';

describe('toConfidence', () => {
  it('is monotonic in the score', () => {
    expect(toConfidence(2)).toBeGreaterThan(toConfidence(1));
    expect(toConfidence(4)).toBeGreaterThan(toConfidence(2));
  });

  it('never exceeds 0.97', () => {
    expect(toConfidence(1000)).toBeLessThanOrEqual(0.97);
  });
});

describe('classifyIssue', () => {
  it('classifies crash reports as bug', () => {
    const result = classifyIssue({
      title: 'App crashes with TypeError on startup',
      body: 'It throws an error every time.',
    });
    expect(result[0]!.label).toBe('bug');
    expect(result[0]!.source).toBe('rules');
    expect(result[0]!.reasons.length).toBeGreaterThan(0);
  });

  it('classifies explicit feature requests as feature', () => {
    const result = classifyIssue({
      title: 'Feature request: add support for YAML output',
      body: 'It would be great to export as YAML.',
    });
    expect(result[0]!.label).toBe('feature');
  });

  it('classifies typo/README reports as docs', () => {
    const result = classifyIssue({
      title: 'Typo in README quick start',
      body: 'The docs show the wrong command.',
    });
    expect(result[0]!.label).toBe('docs');
  });

  it('classifies how-do-I issues as question', () => {
    const result = classifyIssue({
      title: 'How do I configure a custom threshold?',
      body: 'Is it possible to change the default?',
    });
    expect(result[0]!.label).toBe('question');
  });

  it('boosts bug when the body contains a stack trace', () => {
    const withTrace = classifyIssue({
      title: 'Something is off',
      body: 'Error: boom\n    at analyze (file:///app/dist/index.js:42:17)',
    });
    const without = classifyIssue({
      title: 'Something is off',
      body: 'Error: boom',
    });
    const bugWith = withTrace.find((suggestion) => suggestion.label === 'bug')!;
    const bugWithout = without.find((suggestion) => suggestion.label === 'bug')!;
    expect(bugWith.confidence).toBeGreaterThan(bugWithout.confidence);
    expect(bugWith.reasons).toContain('body contains a stack trace');
  });

  it('weights title matches more than body matches', () => {
    const inTitle = classifyIssue({ title: 'Crash on save', body: 'details' });
    const inBody = classifyIssue({ title: 'Something odd', body: 'It can crash on save' });
    const titleBug = inTitle.find((suggestion) => suggestion.label === 'bug')!;
    const bodyBug = inBody.find((suggestion) => suggestion.label === 'bug')!;
    expect(titleBug.confidence).toBeGreaterThan(bodyBug.confidence);
  });

  it('returns an empty array when nothing matches', () => {
    const result = classifyIssue({ title: 'zzz', body: 'xyzzy plugh' });
    expect(result).toEqual([]);
  });

  it('sorts suggestions by confidence descending', () => {
    const result = classifyIssue({
      title: 'Crash when clicking save — how do I avoid it?',
      body: 'Steps to reproduce: click save. It throws an exception.',
    });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.confidence).toBeGreaterThanOrEqual(result[i]!.confidence);
    }
  });

  it('handles a missing body gracefully', () => {
    const result = classifyIssue({ title: 'Crash on start', body: null });
    expect(result[0]!.label).toBe('bug');
  });
});
