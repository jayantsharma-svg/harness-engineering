/**
 * PR description extractor — shells out to `gh pr list` + parses titles
 * and bodies. Gated on `gh` binary present + `gh auth status` succeeds.
 * Returns [] otherwise (caller records skip in summary.skippedSurfaces).
 *
 * Source: docs/changes/craft-pipeline/copy-craft/proposal.md
 *   (Technical Design → Git / GitHub extractors).
 */

import { spawnSync } from 'node:child_process';
import type { ExtractedCopyItem } from '../findings/schema.js';

const GH_TIMEOUT_MS = 10_000;

export interface ExtractPRDescriptionsInput {
  projectRoot: string;
  limit?: number;
}

export interface ExtractPRDescriptionsResult {
  items: ExtractedCopyItem[];
  skipReason?: string;
}

interface PRRecord {
  number: number;
  title: string;
  body: string;
}

export function extractPRDescriptions(
  input: ExtractPRDescriptionsInput
): ExtractPRDescriptionsResult {
  const { projectRoot, limit = 20 } = input;

  if (!hasGhBinary()) {
    return { items: [], skipReason: 'gh binary not found' };
  }
  if (!isGhAuthed(projectRoot)) {
    return { items: [], skipReason: 'gh not authenticated' };
  }

  // Use spawnSync with arg array (no shell) for cross-platform consistency;
  // see commits.ts for the Windows-quoting motivation.
  const result = spawnSync(
    'gh',
    ['pr', 'list', '--state=all', `--limit=${limit}`, '--json', 'number,title,body'],
    {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: GH_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: false,
    }
  );

  if (result.error !== undefined || result.status !== 0) {
    const errMsg = result.error?.message ?? `exit code ${result.status}`;
    return { items: [], skipReason: `gh pr list failed: ${errMsg}` };
  }

  let prs: PRRecord[];
  try {
    prs = JSON.parse(result.stdout) as PRRecord[];
  } catch {
    return { items: [], skipReason: 'gh pr list output not parseable as JSON' };
  }

  const items: ExtractedCopyItem[] = [];
  for (const pr of prs) {
    if (typeof pr.title !== 'string' || typeof pr.number !== 'number') continue;
    const body = typeof pr.body === 'string' ? pr.body : '';
    items.push({
      file: `github:pr/${pr.number}`,
      surface: 'pr-description',
      snippet: body.length > 0 ? `${pr.title}\n\n${body}` : pr.title,
      context: { ref: String(pr.number) },
    });
  }
  return { items };
}

function hasGhBinary(): boolean {
  const result = spawnSync('gh', ['--version'], {
    timeout: GH_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: false,
  });
  return result.error === undefined && result.status === 0;
}

function isGhAuthed(projectRoot: string): boolean {
  const result = spawnSync('gh', ['auth', 'status'], {
    cwd: projectRoot,
    timeout: GH_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  return result.error === undefined && result.status === 0;
}
