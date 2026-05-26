import { describe, expect, it } from 'vitest';
import { buildRoutingUseCase } from '../../src/agent/use-case-builder';
import type { Issue } from '@harness-engineering/types';

const issue: Issue = {
  id: 'i-1',
  identifier: 'i-1',
  title: 'fix: small bug in auth',
  description: null,
  priority: null,
  state: 'planned',
  branchName: null,
  url: null,
  labels: [],
  blockedBy: [],
  spec: null,
  plans: [],
  createdAt: '2026-05-25T00:00:00Z',
  updatedAt: '2026-05-25T00:00:00Z',
  externalId: null,
};

describe('buildRoutingUseCase (Spec B Phase 3)', () => {
  it("returns { kind: 'tier', tier: 'quick-fix' } when backendParam='local'", () => {
    expect(buildRoutingUseCase(issue, 'local', [])).toEqual({
      kind: 'tier',
      tier: 'quick-fix',
    });
  });

  it("returns { kind: 'skill', skillName } when triage maps to a cataloged skill", () => {
    // 'fix: ...' titles with small (default ≤3) changedFileCount trigger
    // code-review under triageIssue. With no signals supplied here the
    // changedFileCount defaults to Infinity, but the small-fix branch
    // gates on (changedFileCount ?? Infinity) <= max, so we need to
    // supply changedFileCount via a different path. Use a docs:
    // title to deterministically trigger the 'docs' triage branch
    // instead — same shape, simpler assertion.
    const docsIssue: Issue = { ...issue, title: 'docs: clarify README' };
    const result = buildRoutingUseCase(docsIssue, undefined, [{ name: 'harness-docs' }]);
    expect(result).toEqual({ kind: 'skill', skillName: 'harness-docs' });
  });

  it('carries cognitiveMode from the catalog entry', () => {
    const docsIssue: Issue = { ...issue, title: 'docs: clarify README' };
    const result = buildRoutingUseCase(docsIssue, undefined, [
      { name: 'harness-docs', cognitiveMode: 'meticulous-implementer' },
    ]);
    expect(result).toEqual({
      kind: 'skill',
      skillName: 'harness-docs',
      cognitiveMode: 'meticulous-implementer',
    });
  });

  it('falls back to kind: tier when catalog has no matching skill (F11)', () => {
    const result = buildRoutingUseCase(issue, undefined, []);
    expect(result.kind).toBe('tier');
  });
});
