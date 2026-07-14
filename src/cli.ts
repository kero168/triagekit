#!/usr/bin/env node
/**
 * triagekit CLI.
 *
 *   triagekit analyze issue.json --existing issues.json
 *   gh api repos/owner/repo/issues/123 | triagekit analyze -
 *   triagekit analyze --event "$GITHUB_EVENT_PATH" --repo owner/repo --comment
 */
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { Command, InvalidArgumentError } from 'commander';
import pc from 'picocolors';
import { analyzeIssue, DEFAULT_MAX_DUPLICATES, DEFAULT_THRESHOLD } from './analyze.js';
import { formatComment, formatJson, formatPretty } from './format.js';
import { fetchOpenIssues, upsertIssueComment } from './github.js';
import { loadIssueFile, parseExistingIssues, parseIssueInput } from './input.js';
import type { ExistingIssue } from './types.js';
import { VERSION } from './version.js';

const color = pc.createColors(process.stderr.isTTY ?? false);

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseNumberOption(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError('expected a number');
  }
  return parsed;
}

interface AnalyzeCliOptions {
  event?: string;
  existing?: string;
  repo?: string;
  token?: string;
  format: string;
  llm: boolean;
  threshold: number;
  maxDuplicates: number;
  comment: boolean;
  dryRun: boolean;
}

async function runAnalyze(issueFile: string | undefined, options: AnalyzeCliOptions): Promise<void> {
  const env = process.env;

  // 1. Load the issue: positional file, "-" (stdin), --event, or $GITHUB_EVENT_PATH.
  const eventPath = options.event ?? env.GITHUB_EVENT_PATH;
  let loaded;
  if (issueFile === '-') {
    loaded = parseIssueInput(JSON.parse(await readStdin()));
  } else if (issueFile) {
    loaded = await loadIssueFile(issueFile);
  } else if (eventPath) {
    loaded = await loadIssueFile(eventPath);
  } else {
    throw new Error(
      'no issue input — pass a JSON file, "-" for stdin, or --event <path> (defaults to $GITHUB_EVENT_PATH)',
    );
  }
  const { issue } = loaded;
  const repo = options.repo ?? loaded.repo ?? env.GITHUB_REPOSITORY;
  const token = options.token ?? env.GITHUB_TOKEN ?? env.GH_TOKEN;

  // 2. Collect existing issues for duplicate detection.
  let existing: ExistingIssue[] = [];
  if (options.existing) {
    existing = parseExistingIssues(JSON.parse(await readFile(options.existing, 'utf8')));
  } else if (repo && token) {
    existing = await fetchOpenIssues({
      repo,
      token,
      excludeNumber: issue.number,
      apiUrl: env.GITHUB_API_URL,
    });
  } else {
    console.error(
      color.dim(
        'note: no --existing file and no repo/token available — skipping duplicate detection',
      ),
    );
  }

  // 3. Analyze.
  const result = await analyzeIssue(issue, existing, {
    threshold: options.threshold,
    maxDuplicates: options.maxDuplicates,
    llm: options.llm,
  });

  // 4. Print.
  if (options.format === 'json') {
    console.log(formatJson(result));
  } else if (options.format === 'pretty') {
    console.log(formatPretty(result, { color: process.stdout.isTTY ?? false }));
  } else {
    throw new Error(`unknown format "${options.format}" (expected "pretty" or "json")`);
  }

  // 5. Optionally comment on the issue.
  if (options.comment) {
    const body = formatComment(result);
    if (options.dryRun) {
      console.error(color.dim('\n--dry-run: would post the following comment:\n'));
      console.error(body);
      return;
    }
    if (!repo) {
      throw new Error(
        '--comment requires a repository (--repo, $GITHUB_REPOSITORY, or an event payload)',
      );
    }
    if (issue.number === undefined) {
      throw new Error('--comment requires the issue to have a "number"');
    }
    if (!token) {
      throw new Error('--comment requires a token (--token or $GITHUB_TOKEN)');
    }
    const { updated, url } = await upsertIssueComment({
      repo,
      token,
      issueNumber: issue.number,
      body,
      apiUrl: env.GITHUB_API_URL,
    });
    console.error(
      color.green(`${updated ? 'updated' : 'posted'} triage comment${url ? `: ${url}` : ''}`),
    );
  }
}

const program = new Command();

program
  .name('triagekit')
  .description('AI-powered issue triage for GitHub — dedupe, label, and demand reproductions.')
  .version(VERSION);

program
  .command('analyze')
  .description('analyze a GitHub issue (JSON file, "-" for stdin, or an Actions event payload)')
  .argument('[issue-file]', 'path to an issue JSON file, or "-" to read from stdin')
  .option('--event <path>', 'path to a GitHub Actions event payload (default: $GITHUB_EVENT_PATH)')
  .option('--existing <path>', 'JSON array of existing issues for duplicate detection')
  .option(
    '--repo <owner/repo>',
    'repository to fetch open issues from and comment on (default: $GITHUB_REPOSITORY or the event payload)',
  )
  .option('--token <token>', 'GitHub token (default: $GITHUB_TOKEN or $GH_TOKEN)')
  .option('-f, --format <format>', 'output format: pretty | json', 'pretty')
  .option('--llm', 'refine the label suggestion with an LLM (requires ANTHROPIC_API_KEY or OPENAI_API_KEY)', false)
  .option(
    '--threshold <number>',
    'duplicate similarity threshold, 0..1',
    parseNumberOption,
    DEFAULT_THRESHOLD,
  )
  .option(
    '--max-duplicates <number>',
    'maximum number of duplicate candidates to report',
    parseNumberOption,
    DEFAULT_MAX_DUPLICATES,
  )
  .option('--comment', 'post the report as a comment on the issue (requires repo + token)', false)
  .option('--dry-run', 'with --comment: print the comment instead of posting it', false)
  .action(async (issueFile: string | undefined, options: AnalyzeCliOptions) => {
    await runAnalyze(issueFile, options);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(color.red(`triagekit: ${error instanceof Error ? error.message : String(error)}`));
  process.exitCode = 1;
});
