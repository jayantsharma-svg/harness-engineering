import { describe, it, expect } from 'vitest';
import type { Roadmap, RoadmapFeature, FeatureStatus } from '@harness-engineering/types';
import { promoteFeature } from '../../src/roadmap/promote';

const EM_DASH = '—';

function feature(partial: Partial<RoadmapFeature> & { name: string }): RoadmapFeature {
  return {
    name: partial.name,
    status: partial.status ?? 'backlog',
    spec: partial.spec ?? null,
    plans: partial.plans ?? [],
    blockedBy: partial.blockedBy ?? [],
    summary: partial.summary ?? '',
    assignee: partial.assignee ?? null,
    priority: partial.priority ?? null,
    externalId: partial.externalId ?? null,
    updatedAt: partial.updatedAt ?? null,
  };
}

/** Single-milestone roadmap holding the given features. */
function roadmapWith(features: RoadmapFeature[], milestoneName = 'Current Work'): Roadmap {
  return {
    frontmatter: {
      project: 'test',
      version: 1,
      lastSynced: '2026-01-01T00:00:00Z',
      lastManualEdit: '2026-01-01T00:00:00Z',
    },
    milestones: [{ name: milestoneName, isBacklog: false, features }],
    assignmentHistory: [],
  };
}

/** Multi-milestone roadmap for ambiguity tests. */
function multiMilestone(
  entries: Array<{ milestone: string; features: RoadmapFeature[] }>
): Roadmap {
  return {
    frontmatter: {
      project: 'test',
      version: 1,
      lastSynced: '2026-01-01T00:00:00Z',
      lastManualEdit: '2026-01-01T00:00:00Z',
    },
    milestones: entries.map((e) => ({
      name: e.milestone,
      isBacklog: false,
      features: e.features,
    })),
    assignmentHistory: [],
  };
}

function findFeature(rm: Roadmap, name: string): RoadmapFeature | undefined {
  return rm.milestones.flatMap((m) => m.features).find((f) => f.name === name);
}

const SPEC = 'docs/changes/x/proposal.md';

describe('promoteFeature', () => {
  describe('D2 state machine', () => {
    it('backlog → planned, sets spec, transitioned backlog→planned', () => {
      const rm = roadmapWith([feature({ name: 'X', status: 'backlog' })]);
      const { result, nextRoadmap } = promoteFeature(rm, { feature: 'X', spec: SPEC });
      expect(result).toMatchObject({ ok: true, transitioned: 'backlog→planned', feature: 'X' });
      const next = findFeature(nextRoadmap, 'X')!;
      expect(next.status).toBe('planned');
      expect(next.spec).toBe(SPEC);
      // input untouched
      expect(findFeature(rm, 'X')!.status).toBe('backlog');
    });

    it.each<FeatureStatus>(['planned', 'blocked', 'needs-human'])(
      '%s → spec-updated, status preserved',
      (status) => {
        const rm = roadmapWith([
          feature({ name: 'X', status, spec: 'docs/changes/x/old.md', summary: 'kept' }),
        ]);
        const { result, nextRoadmap } = promoteFeature(rm, { feature: 'X', spec: SPEC });
        expect(result).toMatchObject({ ok: true, transitioned: 'spec-updated', feature: 'X' });
        const next = findFeature(nextRoadmap, 'X')!;
        expect(next.status).toBe(status);
        expect(next.spec).toBe(SPEC);
      }
    );

    it('in-progress → refuse, roadmap unchanged', () => {
      const rm = roadmapWith([feature({ name: 'X', status: 'in-progress', spec: 'a.md' })]);
      const { result, nextRoadmap } = promoteFeature(rm, { feature: 'X', spec: SPEC });
      expect(result).toMatchObject({ ok: false, reason: 'in-progress', feature: 'X' });
      expect(findFeature(nextRoadmap, 'X')!.spec).toBe('a.md');
      expect(findFeature(nextRoadmap, 'X')!.status).toBe('in-progress');
    });

    it('done → refuse, roadmap unchanged', () => {
      const rm = roadmapWith([feature({ name: 'X', status: 'done', spec: 'a.md' })]);
      const { result, nextRoadmap } = promoteFeature(rm, { feature: 'X', spec: SPEC });
      expect(result).toMatchObject({ ok: false, reason: 'done', feature: 'X' });
      expect(findFeature(nextRoadmap, 'X')!.status).toBe('done');
    });

    it('not found → not-found with closestMatches ranked by edit distance', () => {
      const rm = roadmapWith([
        feature({ name: 'Auto-promote' }),
        feature({ name: 'Auto-sync' }),
        feature({ name: 'Totally unrelated thing' }),
      ]);
      const { result } = promoteFeature(rm, { feature: 'Auto-promot', spec: SPEC });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected failure');
      expect(result.reason).toBe('not-found');
      if (result.reason !== 'not-found') throw new Error('expected not-found');
      expect(result.closestMatches[0]).toBe('Auto-promote');
      expect(result.closestMatches.length).toBeLessThanOrEqual(3);
    });
  });

  describe('D1 lookup', () => {
    it('lookup is case-insensitive and whitespace-trimmed', () => {
      const rm = roadmapWith([feature({ name: 'Auto-Promote', status: 'backlog' })]);
      const { result } = promoteFeature(rm, { feature: '  auto-promote  ', spec: SPEC });
      expect(result).toMatchObject({ ok: true, transitioned: 'backlog→planned' });
    });

    it('same heading in two milestones → ambiguous with milestone-qualified matches', () => {
      const rm = multiMilestone([
        { milestone: 'v1.0 Foundation', features: [feature({ name: 'Auto-promote' })] },
        { milestone: 'v2.0 Polish', features: [feature({ name: 'Auto-promote' })] },
      ]);
      const { result, nextRoadmap } = promoteFeature(rm, { feature: 'Auto-promote', spec: SPEC });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected failure');
      expect(result.reason).toBe('ambiguous');
      if (result.reason !== 'ambiguous') throw new Error('expected ambiguous');
      expect(result.matches).toEqual([
        'v1.0 Foundation > Auto-promote',
        'v2.0 Polish > Auto-promote',
      ]);
      // unchanged
      expect(nextRoadmap.milestones[0]!.features[0]!.status).toBe('backlog');
    });
  });

  describe('D4 idempotency', () => {
    it('planned + identical spec → noop, no mutation', () => {
      const rm = roadmapWith([feature({ name: 'X', status: 'planned', spec: SPEC })]);
      const { result, nextRoadmap } = promoteFeature(rm, { feature: 'X', spec: SPEC });
      expect(result).toMatchObject({ ok: true, transitioned: 'noop' });
      expect(JSON.stringify(nextRoadmap)).toBe(JSON.stringify(rm));
    });

    it('planned + different spec → spec-updated', () => {
      const rm = roadmapWith([feature({ name: 'X', status: 'planned', spec: 'old.md' })]);
      const { result, nextRoadmap } = promoteFeature(rm, { feature: 'X', spec: SPEC });
      expect(result).toMatchObject({ ok: true, transitioned: 'spec-updated' });
      expect(findFeature(nextRoadmap, 'X')!.spec).toBe(SPEC);
    });
  });

  describe('D5 field-write policy', () => {
    it('writes summary only when current summary is empty', () => {
      const rm = roadmapWith([feature({ name: 'X', status: 'backlog', summary: '' })]);
      const { nextRoadmap } = promoteFeature(rm, {
        feature: 'X',
        spec: SPEC,
        summary: 'from H1',
      });
      expect(findFeature(nextRoadmap, 'X')!.summary).toBe('from H1');
    });

    it('treats em-dash summary as empty', () => {
      const rm = roadmapWith([feature({ name: 'X', status: 'backlog', summary: EM_DASH })]);
      const { nextRoadmap } = promoteFeature(rm, {
        feature: 'X',
        spec: SPEC,
        summary: 'from H1',
      });
      expect(findFeature(nextRoadmap, 'X')!.summary).toBe('from H1');
    });

    it('does not overwrite a human-written summary', () => {
      const rm = roadmapWith([
        feature({ name: 'X', status: 'backlog', summary: 'human wrote this' }),
      ]);
      const { nextRoadmap } = promoteFeature(rm, {
        feature: 'X',
        spec: SPEC,
        summary: 'from H1',
      });
      expect(findFeature(nextRoadmap, 'X')!.summary).toBe('human wrote this');
    });

    it('preserves Plan, Assignee, Priority, External-ID, Blockers, Milestone', () => {
      const original = feature({
        name: 'X',
        status: 'backlog',
        plans: ['docs/plans/p.md'],
        blockedBy: ['Other'],
        assignee: 'alice',
        priority: 'P1',
        externalId: 'github:o/r#7',
      });
      const rm = roadmapWith([original], 'Keep This Milestone');
      const { nextRoadmap } = promoteFeature(rm, { feature: 'X', spec: SPEC });
      const next = findFeature(nextRoadmap, 'X')!;
      expect(next.plans).toEqual(['docs/plans/p.md']);
      expect(next.blockedBy).toEqual(['Other']);
      expect(next.assignee).toBe('alice');
      expect(next.priority).toBe('P1');
      expect(next.externalId).toBe('github:o/r#7');
      expect(nextRoadmap.milestones[0]!.name).toBe('Keep This Milestone');
    });
  });
});
