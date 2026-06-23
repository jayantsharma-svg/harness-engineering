import { describe, it, expect } from 'vitest';
import { strength006AutoapproveBaseline } from './strength-006-autoapprove-baseline';
import type { ProjectContext } from '../types';

function ctx(partial: Partial<ProjectContext>): ProjectContext {
  return {
    root: '/r',
    mode: 'adopter',
    config: null,
    preCommit: null,
    hookFiles: [],
    workflows: [],
    healthSnapshot: null,
    ...partial,
  };
}

const FAILING_WF = `name: auto-approve baseline
on: pull_request
jobs:
  approve:
    runs-on: ubuntu-latest
    steps:
      - uses: hmarr/auto-approve-action@v3
        with:
          token: \${{ secrets.BASELINE_AUTOAPPROVE_PAT }}
      - run: gh pr merge --auto
`;

const PASSING_WF_GATED = `name: gated automerge
on: pull_request_review
jobs:
  merge:
    runs-on: ubuntu-latest
    if: github.event.review.state == 'approved'
    steps:
      - run: gh pr merge --auto
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

const PASSING_WF_NO_AUTO = `name: ci
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`;

describe('STRENGTH-006 auto-approve baseline PR', () => {
  it('flags a PAT-gated auto-approve with no independent review', () => {
    const findings = strength006AutoapproveBaseline.detect(
      ctx({ workflows: [{ path: '/r/.github/workflows/auto.yml', text: FAILING_WF }] })
    );
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.id).toBe('STRENGTH-006');
    expect(f.file).toBe('/r/.github/workflows/auto.yml');
    expect(f.line).toBeGreaterThan(0);
    expect('severity' in f).toBe(false);
  });

  it('passes when auto-merge is gated on an approved review', () => {
    expect(
      strength006AutoapproveBaseline.detect(
        ctx({ workflows: [{ path: '/r/.github/workflows/merge.yml', text: PASSING_WF_GATED }] })
      )
    ).toEqual([]);
  });

  it('passes a workflow with no auto-approve/merge', () => {
    expect(
      strength006AutoapproveBaseline.detect(
        ctx({ workflows: [{ path: '/r/.github/workflows/ci.yml', text: PASSING_WF_NO_AUTO }] })
      )
    ).toEqual([]);
  });

  it('is not evaluable when there are no workflows', () => {
    const c = ctx({ workflows: [] });
    expect(strength006AutoapproveBaseline.evaluable?.(c)).toBe(false);
    expect(strength006AutoapproveBaseline.detect(c)).toEqual([]);
  });
});
