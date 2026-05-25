import { describe, it, expect } from 'vitest';
import { rubricApplies, SEED_RUBRICS } from '../../src/spec-craft/catalog/rubrics/index';

describe('rubricApplies', () => {
  it('star (*) matches every section', () => {
    const sharpness = SEED_RUBRICS.find((r) => r.id === 'SPEC-R001')!;
    expect(rubricApplies(sharpness, 'decisions')).toBe(true);
    expect(rubricApplies(sharpness, 'whatever')).toBe(true);
  });

  it('exact canonical name matches', () => {
    const joints = SEED_RUBRICS.find((r) => r.id === 'SPEC-R002')!;
    expect(rubricApplies(joints, 'decisions')).toBe(true);
    expect(rubricApplies(joints, 'scope')).toBe(true);
    expect(rubricApplies(joints, 'technical-design')).toBe(true);
    expect(rubricApplies(joints, 'overview')).toBe(false);
  });

  it('regex matches sections with prefix', () => {
    const honest = SEED_RUBRICS.find((r) => r.id === 'SPEC-R005')!;
    expect(rubricApplies(honest, 'rationalizations')).toBe(true);
    expect(rubricApplies(honest, 'rationalizations-to-reject')).toBe(true);
    expect(rubricApplies(honest, 'decisions')).toBe(false);
  });

  it('non-goals regex matches multiple section patterns', () => {
    const nonGoals = SEED_RUBRICS.find((r) => r.id === 'SPEC-R006')!;
    expect(rubricApplies(nonGoals, 'out-of-scope')).toBe(true);
    expect(rubricApplies(nonGoals, 'out-of-scope-v1')).toBe(true);
    expect(rubricApplies(nonGoals, 'non-goals')).toBe(true);
    expect(rubricApplies(nonGoals, 'scope')).toBe(false);
  });
});

describe('SEED_RUBRICS', () => {
  it('contains exactly 7 seed rubrics', () => {
    expect(SEED_RUBRICS).toHaveLength(7);
  });

  it('every rubric has an ID in the SPEC-R\\d{3} namespace', () => {
    for (const r of SEED_RUBRICS) {
      expect(r.id).toMatch(/^SPEC-R\d{3}$/);
    }
  });

  it('every rubric has reserved ADR 0020 catalog fields populated', () => {
    for (const r of SEED_RUBRICS) {
      expect(r.contribution.addedAt).toBeTruthy();
      expect(r.contribution.addedBy).toBe('seed');
      expect(r.signal.invocations).toBe(0);
      expect(r.version).toBeGreaterThan(0);
    }
  });
});
