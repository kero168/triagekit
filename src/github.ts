/**
 * Minimal GitHub REST client — only the two calls triagekit needs, written
 * against the built-in `fetch` so there is no SDK dependency. Honors
 * GITHUB_API_URL via the `apiUrl` option for GitHub Enterprise Server.
 */
import type { ExistingIssue } from './types.js';
import { VERSION } from './version.js';

export const DEFAULT_API_URL = 'https://api.github.com';

/** Hidden marker appended to triagekit comments so reruns update in place. */
export const COMMENT_MARKER = '<!-- triagekit:report -->';

export interface GithubOptions {
  /** Repository in "owner/name" form. */
  repo: string;
  /** Token with `issues: read` (and `issues: write` for commenting). */
  token: string;
  /** API base URL (default https://api.github.com; set for GHES). */
  apiUrl?: string;
  /** fetch implementation, injectable for tests. */
  fetchImpl?: typeof fetch;
}

function requestHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': `triagekit/${VERSION}`,
    'x-github-api-version': '2022-11-28',
  };
}

async function assertOk(response: Response, context: string): Promise<void> {
  if (response.ok) return;
  const detail = (await response.text()).slice(0, 200);
  throw new Error(`GitHub API ${context} returned ${response.status}: ${detail}`);
}

export interface FetchOpenIssuesOptions extends GithubOptions {
  /** Issue number to exclude (usually the issue being analyzed). */
  excludeNumber?: number;
  /** Pages of 100 to fetch at most (default 3, i.e. up to 300 issues). */
  maxPages?: number;
}

/** List open issues (pull requests excluded) for duplicate detection. */
export async function fetchOpenIssues(
  options: FetchOpenIssuesOptions,
): Promise<ExistingIssue[]> {
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxPages = options.maxPages ?? 3;
  const issues: ExistingIssue[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `${apiUrl}/repos/${options.repo}/issues?state=open&per_page=100&page=${page}`;
    const response = await fetchImpl(url, { headers: requestHeaders(options.token) });
    await assertOk(response, `GET ${url}`);
    const batch = (await response.json()) as Array<Record<string, unknown>>;
    for (const item of batch) {
      if (item.pull_request) continue; // the issues endpoint also returns PRs
      if (typeof item.number !== 'number' || typeof item.title !== 'string') continue;
      if (item.number === options.excludeNumber) continue;
      issues.push({
        number: item.number,
        title: item.title,
        state: typeof item.state === 'string' ? item.state : 'open',
        html_url: typeof item.html_url === 'string' ? item.html_url : undefined,
      });
    }
    if (batch.length < 100) break;
  }
  return issues;
}

export interface UpsertCommentOptions extends GithubOptions {
  issueNumber: number;
  body: string;
  /** Marker used to find a previous triagekit comment (default COMMENT_MARKER). */
  marker?: string;
}

export interface UpsertCommentResult {
  /** True when an existing triagekit comment was updated instead of creating one. */
  updated: boolean;
  url?: string;
}

/**
 * Post the triage report as an issue comment. If a previous triagekit comment
 * exists (identified by the hidden marker), it is updated in place so an issue
 * never accumulates a pile of bot comments.
 */
export async function upsertIssueComment(
  options: UpsertCommentOptions,
): Promise<UpsertCommentResult> {
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const marker = options.marker ?? COMMENT_MARKER;
  const headers = requestHeaders(options.token);

  const listUrl = `${apiUrl}/repos/${options.repo}/issues/${options.issueNumber}/comments?per_page=100`;
  const listResponse = await fetchImpl(listUrl, { headers });
  await assertOk(listResponse, `GET ${listUrl}`);
  const comments = (await listResponse.json()) as Array<Record<string, unknown>>;
  const previous = comments.find(
    (comment) => typeof comment.body === 'string' && comment.body.includes(marker),
  );

  if (previous && typeof previous.id === 'number') {
    const patchUrl = `${apiUrl}/repos/${options.repo}/issues/comments/${previous.id}`;
    const response = await fetchImpl(patchUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body: options.body }),
    });
    await assertOk(response, `PATCH ${patchUrl}`);
    const data = (await response.json()) as { html_url?: string };
    return { updated: true, url: data.html_url };
  }

  const postUrl = `${apiUrl}/repos/${options.repo}/issues/${options.issueNumber}/comments`;
  const response = await fetchImpl(postUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: options.body }),
  });
  await assertOk(response, `POST ${postUrl}`);
  const data = (await response.json()) as { html_url?: string };
  return { updated: false, url: data.html_url };
}
