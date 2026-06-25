import { describe, it, expect } from 'vitest';
import type { WorkflowConfig } from '@harness-engineering/types';
import { deriveSeedPaths } from '../../src/orchestrator';

/** Minimal config stub — only the fields deriveSeedPaths reads matter. */
function configWith(tracker: Partial<WorkflowConfig['tracker']>): WorkflowConfig {
  return {
    tracker: {
      kind: 'roadmap',
      activeStates: ['planned'],
      terminalStates: ['done'],
      ...tracker,
    },
  } as unknown as WorkflowConfig;
}

describe('deriveSeedPaths', () => {
  it('always seeds the brainstorm proposal directory', () => {
    expect(deriveSeedPaths(configWith({}))).toContain('.harness/proposals');
  });

  it('uses the configured roadmap filePath when the tracker is roadmap-backed', () => {
    const paths = deriveSeedPaths(configWith({ kind: 'roadmap', filePath: 'planning/board.md' }));
    expect(paths).toEqual(['.harness/proposals', 'planning/board.md']);
  });

  it('falls back to docs/roadmap.md when filePath is unset', () => {
    const paths = deriveSeedPaths(configWith({ kind: 'roadmap', filePath: undefined }));
    expect(paths).toEqual(['.harness/proposals', 'docs/roadmap.md']);
  });

  it('falls back to docs/roadmap.md for a non-roadmap tracker (filePath is not a roadmap)', () => {
    // A github-issues tracker has no roadmap filePath semantics; seeding the
    // default keeps a file-backed roadmap (if present) carried over.
    const paths = deriveSeedPaths(configWith({ kind: 'github-issues', filePath: '/tmp/x.json' }));
    expect(paths).toEqual(['.harness/proposals', 'docs/roadmap.md']);
  });
});
