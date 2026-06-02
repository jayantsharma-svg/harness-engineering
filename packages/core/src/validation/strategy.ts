import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Ok, Err } from '../shared/result';
import type { Result } from '../shared/result';
import { parseStrategyDoc, asStrategyDoc } from '../strategy/parser';
import { StrategyDocSchema } from '../strategy/schema';
import { validateConfig } from './config';
import type { ConfigError } from './types';
import { createError } from '../shared/errors';

export interface StrategyValidation {
  /** Whether STRATEGY.md exists at the cwd root. */
  present: boolean;
  /** True when absent (soft-fail) or when present and the schema accepts it. */
  valid: boolean;
}

/**
 * Validate `STRATEGY.md` at the project root.
 *
 * Soft-fail when absent (returns `present: false, valid: true`) — the file is
 * an optional upstream anchor, not a hard prerequisite. When present, both
 * frontmatter and section content are validated; any schema violation returns
 * an Err with the file path and a descriptive message.
 */
export async function validateStrategy(
  cwd: string
): Promise<Result<StrategyValidation, ConfigError>> {
  const strategyPath = path.join(cwd, 'STRATEGY.md');
  let raw: string;
  try {
    raw = await fs.readFile(strategyPath, 'utf-8');
  } catch {
    return Ok({ present: false, valid: true });
  }

  const parsed = parseStrategyDoc(raw);
  const doc = asStrategyDoc(parsed);
  if (doc === null) {
    return Err(
      createError<ConfigError>(
        'VALIDATION_FAILED',
        'STRATEGY.md frontmatter is missing required fields (name, last_updated, version)',
        {},
        [
          'Add YAML frontmatter at the top of STRATEGY.md with name (string), last_updated (YYYY-MM-DD), and version (positive integer)',
        ]
      )
    );
  }

  const result = validateConfig(doc, StrategyDocSchema);
  if (!result.ok) return Err(result.error);
  return Ok({ present: true, valid: true });
}
