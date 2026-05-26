/**
 * Commit subject extractor — shells out to `git log` to capture recent
 * commit subjects with their hashes. Returns [] when not in a git repo
 * (caller records the skip in summary.skippedSurfaces).
 *
 * Source: docs/changes/craft-pipeline/copy-craft/proposal.md
 *   (Technical Design → Git / GitHub extractors).
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExtractedCopyItem } from '../findings/schema.js';

const GIT_TIMEOUT_MS = 10_000;

export interface ExtractCommitsInput {
  projectRoot: string;
  since?: string;
  limit?: number;
}

export interface ExtractCommitsResult {
  items: ExtractedCopyItem[];
  skipReason?: string;
}

export function extractCommits(input: ExtractCommitsInput): ExtractCommitsResult {
  const { projectRoot, since = '1 month ago', limit = 100 } = input;

  if (!isGitRepo(projectRoot)) {
    return { items: [], skipReason: 'not a git repo' };
  }

  // Use spawnSync with arg array (not execSync with a command string) so we
  // bypass shell quoting differences between POSIX and Windows cmd. On
  // Windows, single quotes around the --pretty=format argument were being
  // preserved verbatim, suffixing every commit subject with a trailing `'`.
  const result = spawnSync(
    'git',
    ['log', `--pretty=format:%H%x09%s`, `--since=${since}`, '-n', String(limit)],
    {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: false,
    }
  );

  if (result.error !== undefined || result.status !== 0) {
    const errMsg = result.error?.message ?? `exit code ${result.status}`;
    return { items: [], skipReason: `git log failed: ${errMsg}` };
  }

  const items: ExtractedCopyItem[] = [];
  for (const line of result.stdout.split('\n')) {
    if (line.trim().length === 0) continue;
    const [hash, subject] = line.split('\t', 2);
    if (hash === undefined || subject === undefined) continue;
    items.push({
      file: `git:${hash}`,
      surface: 'commit',
      snippet: subject.trim(),
      context: { ref: hash },
    });
  }
  return { items };
}

function isGitRepo(projectRoot: string): boolean {
  // Walk up to find .git directory or file (worktrees use a file).
  let dir = projectRoot;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}
