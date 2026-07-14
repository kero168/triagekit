import { describe, expect, it } from 'vitest';
import { checkReproduction } from '../src/repro.js';

const COMPLETE_BODY = `
### Steps to reproduce
1. Run \`npx triagekit analyze issue.json\`
2. Observe the crash

Expected: a report is printed.
Actual: the process exits with a stack trace instead.

Environment: triagekit 0.1.0, Node v20.11.0, macOS 14.4
`;

describe('checkReproduction', () => {
  it('reports a complete bug report as complete', () => {
    const report = checkReproduction({ title: 'Crash', body: COMPLETE_BODY });
    expect(report.missing).toEqual([]);
    expect(report.score).toBe(1);
    for (const field of report.fields) {
      expect(field.present).toBe(true);
      expect(field.evidence).toBeTruthy();
    }
  });

  it('reports everything missing for an empty body', () => {
    const report = checkReproduction({ title: 'Broken', body: '' });
    expect(report.missing).toHaveLength(4);
    expect(report.score).toBe(0);
    for (const field of report.missing) {
      expect(field.hint.length).toBeGreaterThan(0);
    }
  });

  it('detects semver version strings', () => {
    const report = checkReproduction({ title: 'x', body: 'happens on 2.3.1' });
    expect(report.fields.find((field) => field.id === 'version')!.present).toBe(true);
  });

  it('detects "Node v20" style versions', () => {
    const report = checkReproduction({ title: 'x', body: 'running node v20' });
    expect(report.fields.find((field) => field.id === 'version')!.present).toBe(true);
  });

  it('detects operating systems', () => {
    const report = checkReproduction({ title: 'x', body: 'This happens on Ubuntu 24.04 only' });
    expect(report.fields.find((field) => field.id === 'os')!.present).toBe(true);
  });

  it('detects numbered step lists', () => {
    const report = checkReproduction({ title: 'x', body: '1. open the app\n2. click save' });
    expect(report.fields.find((field) => field.id === 'steps')!.present).toBe(true);
  });

  it('detects fenced code blocks as steps', () => {
    const report = checkReproduction({ title: 'x', body: '```\nnpm start\n```' });
    expect(report.fields.find((field) => field.id === 'steps')!.present).toBe(true);
  });

  it('requires BOTH expected and actual wording', () => {
    const onlyExpected = checkReproduction({ title: 'x', body: 'I expected it to pass.' });
    expect(onlyExpected.fields.find((field) => field.id === 'expected-actual')!.present).toBe(false);
    const both = checkReproduction({
      title: 'x',
      body: 'I expected it to pass but it failed instead.',
    });
    expect(both.fields.find((field) => field.id === 'expected-actual')!.present).toBe(true);
  });

  it('passes through the applicable flag', () => {
    expect(checkReproduction({ title: 'x', body: '' }, { applicable: false }).applicable).toBe(false);
    expect(checkReproduction({ title: 'x', body: '' }).applicable).toBe(true);
  });

  it('handles a null body', () => {
    const report = checkReproduction({ title: 'x', body: null });
    expect(report.missing).toHaveLength(4);
  });
});
