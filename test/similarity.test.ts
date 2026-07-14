import { describe, expect, it } from 'vitest';
import {
  charNgrams,
  findDuplicates,
  jaccard,
  normalizeText,
  titleSimilarity,
  tokenize,
} from '../src/similarity.js';

describe('normalizeText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeText('CLI crashes: `analyze` fails!')).toBe('cli crashes analyze fails');
  });

  it('collapses whitespace', () => {
    expect(normalizeText('a   b\t c')).toBe('a b c');
  });

  it('keeps unicode letters and digits', () => {
    expect(normalizeText('Node 20 で動かない')).toBe('node 20 で動かない');
  });
});

describe('tokenize', () => {
  it('drops stopwords and single characters', () => {
    expect(tokenize('the CLI is broken when I run it')).toEqual(['cli', 'broken', 'run']);
  });

  it('splits on dots and hyphens', () => {
    expect(tokenize('dry-run node.js')).toEqual(['dry', 'run', 'node', 'js']);
  });
});

describe('charNgrams', () => {
  it('produces sliding 3-grams', () => {
    expect([...charNgrams('abcd')]).toEqual(['abc', 'bcd']);
  });

  it('returns the whole string when shorter than n', () => {
    expect([...charNgrams('ab')]).toEqual(['ab']);
  });

  it('returns an empty set for empty input', () => {
    expect(charNgrams('').size).toBe(0);
  });
});

describe('jaccard', () => {
  it('is 1 for identical non-empty sets', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });

  it('is 0 when both sets are empty', () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it('computes intersection over union', () => {
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBeCloseTo(0.5);
  });
});

describe('titleSimilarity', () => {
  it('scores identical titles as 1', () => {
    expect(titleSimilarity('CLI crashes on empty config', 'CLI crashes on empty config')).toBeCloseTo(1);
  });

  it('scores near-duplicates high', () => {
    const score = titleSimilarity(
      'CLI crashes with TypeError when config file is empty',
      'CLI crashes with TypeError when config is empty',
    );
    expect(score).toBeGreaterThan(0.6);
  });

  it('scores unrelated titles low', () => {
    const score = titleSimilarity('Add dark mode to the settings page', 'CLI crashes on startup');
    expect(score).toBeLessThan(0.2);
  });

  it('is symmetric', () => {
    const a = 'Support YAML config files';
    const b = 'YAML config file support';
    expect(titleSimilarity(a, b)).toBeCloseTo(titleSimilarity(b, a));
  });
});

describe('findDuplicates', () => {
  const existing = [
    { number: 1, title: 'CLI crashes with TypeError when config is empty' },
    { number: 2, title: 'Add JSON output format' },
    { number: 3, title: 'CLI crash: TypeError on empty config file' },
  ];

  it('returns candidates above the threshold, best first', () => {
    const result = findDuplicates(
      { title: 'CLI crashes with TypeError when config file is empty' },
      existing,
      { threshold: 0.4 },
    );
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]!.number).toBe(1);
    expect(result[0]!.score).toBeGreaterThanOrEqual(result[1]!.score);
  });

  it('excludes the issue itself by number', () => {
    const result = findDuplicates(
      { number: 1, title: 'CLI crashes with TypeError when config is empty' },
      existing,
      { threshold: 0.1 },
    );
    expect(result.map((candidate) => candidate.number)).not.toContain(1);
  });

  it('respects the limit', () => {
    const result = findDuplicates(
      { title: 'CLI crashes with TypeError when config file is empty' },
      existing,
      { threshold: 0.1, limit: 1 },
    );
    expect(result).toHaveLength(1);
  });

  it('returns an empty array when nothing is similar enough', () => {
    const result = findDuplicates({ title: 'Completely unrelated topic' }, existing);
    expect(result).toEqual([]);
  });
});
