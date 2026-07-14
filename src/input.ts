/**
 * Input parsing for the CLI: accepts either a raw issue object (as returned
 * by `gh api repos/{owner}/{repo}/issues/{number}`) or a full GitHub Actions
 * `issues` event payload (which nests the issue under `.issue`).
 */
import { readFile } from 'node:fs/promises';
import type { ExistingIssue, Issue } from './types.js';

export interface LoadedIssue {
  issue: Issue;
  /** Repository ("owner/name") when derivable from an event payload. */
  repo?: string;
}

/** Interpret parsed JSON as an issue or an issues event payload. */
export function parseIssueInput(data: unknown): LoadedIssue {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('issue input must be a JSON object');
  }
  const record = data as Record<string, unknown>;
  if (record.issue && typeof record.issue === 'object') {
    const repository = record.repository as { full_name?: string } | undefined;
    return {
      issue: record.issue as Issue,
      repo: typeof repository?.full_name === 'string' ? repository.full_name : undefined,
    };
  }
  if (typeof record.title !== 'string') {
    throw new Error(
      'input JSON is neither an issue (missing "title") nor an issues event payload (missing "issue")',
    );
  }
  return { issue: record as unknown as Issue };
}

/** Read and parse an issue (or event payload) from a JSON file. */
export async function loadIssueFile(path: string): Promise<LoadedIssue> {
  return parseIssueInput(JSON.parse(await readFile(path, 'utf8')));
}

/** Validate a JSON array of existing issues (for --existing). */
export function parseExistingIssues(data: unknown): ExistingIssue[] {
  if (!Array.isArray(data)) {
    throw new Error('existing issues input must be a JSON array of {number, title} objects');
  }
  return data
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .filter((item) => typeof item.number === 'number' && typeof item.title === 'string')
    .map((item) => ({
      number: item.number as number,
      title: item.title as string,
      state: typeof item.state === 'string' ? item.state : undefined,
      html_url: typeof item.html_url === 'string' ? item.html_url : undefined,
    }));
}

/** Read and validate existing issues from a JSON file. */
export async function loadExistingIssuesFile(path: string): Promise<ExistingIssue[]> {
  return parseExistingIssues(JSON.parse(await readFile(path, 'utf8')));
}
