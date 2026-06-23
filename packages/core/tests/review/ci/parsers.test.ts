import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseClaudeVerdict } from '../../../src/review/ci/parsers/claude';
import { parseCiReviewVerdict } from '../../../src/review/ci/verdict-schema';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('claude verdict parser', () => {
  it('maps raw claude output to a schema-valid CiReviewVerdict', () => {
    const v = parseClaudeVerdict(fx('claude-verdict.json'));
    const validated = parseCiReviewVerdict(v); // throws if invalid
    expect(validated.runner).toBe('claude');
    expect(validated.ranLlmTier).toBe(true);
    expect(validated.assessment).toBe('request-changes');
    expect(validated.blockingFindings.every((f) => f.severity === 'critical')).toBe(true);
  });

  it('throws on non-JSON input', () => {
    expect(() => parseClaudeVerdict('not json')).toThrow();
  });
});
