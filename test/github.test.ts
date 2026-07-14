import { describe, expect, it, vi } from 'vitest';
import { COMMENT_MARKER, fetchOpenIssues, upsertIssueComment } from '../src/github.js';

function jsonResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

describe('fetchOpenIssues', () => {
  it('maps issues and filters out pull requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        { number: 1, title: 'Real issue', state: 'open', html_url: 'https://x/1' },
        { number: 2, title: 'A pull request', pull_request: {} },
        { number: 3, title: 'Another issue', state: 'open' },
      ]),
    );
    const issues = await fetchOpenIssues({
      repo: 'kero168/triagekit',
      token: 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(issues.map((issue) => issue.number)).toEqual([1, 3]);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toContain('/repos/kero168/triagekit/issues?state=open');
    expect(init.headers.authorization).toBe('Bearer tok');
  });

  it('excludes the analyzed issue number', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        { number: 7, title: 'Self' },
        { number: 8, title: 'Other' },
      ]),
    );
    const issues = await fetchOpenIssues({
      repo: 'o/r',
      token: 't',
      excludeNumber: 7,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(issues.map((issue) => issue.number)).toEqual([8]);
  });

  it('stops paginating when a page is not full', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ number: 1, title: 'only' }]));
    await fetchOpenIssues({
      repo: 'o/r',
      token: 't',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws on HTTP errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: 'bad' }, false, 401));
    await expect(
      fetchOpenIssues({ repo: 'o/r', token: 't', fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/401/);
  });
});

describe('upsertIssueComment', () => {
  it('creates a new comment when no marker is found', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 1, body: 'unrelated comment' }]))
      .mockResolvedValueOnce(jsonResponse({ html_url: 'https://x/comment/2' }));
    const result = await upsertIssueComment({
      repo: 'o/r',
      token: 't',
      issueNumber: 5,
      body: `report\n${COMMENT_MARKER}`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.updated).toBe(false);
    expect(result.url).toBe('https://x/comment/2');
    const [url, init] = fetchImpl.mock.calls[1]!;
    expect(url).toBe('https://api.github.com/repos/o/r/issues/5/comments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).body).toContain(COMMENT_MARKER);
  });

  it('updates the previous triagekit comment in place', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 10, body: 'human comment' },
          { id: 11, body: `old report\n${COMMENT_MARKER}` },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ html_url: 'https://x/comment/11' }));
    const result = await upsertIssueComment({
      repo: 'o/r',
      token: 't',
      issueNumber: 5,
      body: `new report\n${COMMENT_MARKER}`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.updated).toBe(true);
    const [url, init] = fetchImpl.mock.calls[1]!;
    expect(url).toBe('https://api.github.com/repos/o/r/issues/comments/11');
    expect(init.method).toBe('PATCH');
  });

  it('respects a custom apiUrl (GHES)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}));
    await upsertIssueComment({
      repo: 'o/r',
      token: 't',
      issueNumber: 1,
      body: 'x',
      apiUrl: 'https://ghe.example.com/api/v3',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl.mock.calls[0]![0]).toContain('https://ghe.example.com/api/v3/repos/o/r');
  });
});
