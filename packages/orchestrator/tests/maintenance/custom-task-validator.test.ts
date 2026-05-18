import { describe, it, expect } from 'vitest';
import type { CustomTaskDefinition } from '@harness-engineering/types';
import {
  validateCustomTasks,
  type CustomTaskValidationError,
} from '../../src/maintenance/custom-task-validator';
import type { TaskDefinition } from '../../src/maintenance/types';

const BUILT_INS: readonly TaskDefinition[] = [
  {
    id: 'arch-violations',
    type: 'mechanical-ai',
    description: 'built-in',
    schedule: '0 2 * * *',
    branch: 'harness-maint/arch-fixes',
    checkCommand: ['check-arch'],
    fixSkill: 'harness-arch-fix',
  },
  {
    id: 'dead-code',
    type: 'pure-ai',
    description: 'built-in',
    schedule: '0 2 * * 0',
    branch: 'harness-maint/dead-code',
    fixSkill: 'harness-codebase-cleanup',
  },
];

function expectError(
  errors: CustomTaskValidationError[],
  pathPrefix: string,
  fragment: string
): void {
  expect(errors.some((e) => e.path.startsWith(pathPrefix) && e.message.includes(fragment))).toBe(
    true
  );
}

describe('validateCustomTasks', () => {
  it('returns Ok when customTasks is undefined', () => {
    const result = validateCustomTasks(undefined, BUILT_INS);
    expect(result.ok).toBe(true);
  });

  it('returns Ok for a single valid mechanical-ai custom task', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      'my-lint': {
        type: 'mechanical-ai',
        description: 'Run a custom lint',
        schedule: '0 3 * * *',
        branch: 'harness-maint/my-lint',
        checkScript: { path: './bin/my-lint' },
        fixSkill: 'my-skill',
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(true);
  });

  it('rejects when checkCommand and checkScript are both set', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      'dual-check': {
        type: 'mechanical-ai',
        description: 'bad',
        schedule: '0 3 * * *',
        branch: 'b',
        checkCommand: ['foo'],
        checkScript: { path: './x' },
        fixSkill: 's',
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(result.error, 'customTasks.dual-check', 'OR checkScript');
    }
  });

  it('rejects when a check-needing task has neither checkCommand nor checkScript', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      'no-check': {
        type: 'mechanical-ai',
        description: 'bad',
        schedule: '0 3 * * *',
        branch: 'b',
        fixSkill: 's',
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(
        result.error,
        'customTasks.no-check',
        'must declare either checkCommand or checkScript'
      );
    }
  });

  it('rejects mechanical-ai missing fixSkill or branch', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      partial: {
        type: 'mechanical-ai',
        description: 'bad',
        schedule: '0 3 * * *',
        branch: null,
        checkScript: { path: './x' },
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(
        result.error,
        'customTasks.partial.fixSkill',
        'mechanical-ai task requires fixSkill'
      );
      expectError(result.error, 'customTasks.partial.branch', 'requires a non-null branch');
    }
  });

  it('rejects task IDs that collide with built-ins', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      'arch-violations': {
        type: 'mechanical-ai',
        description: 'collides',
        schedule: '0 3 * * *',
        branch: 'b',
        checkScript: { path: './x' },
        fixSkill: 's',
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(result.error, 'customTasks.arch-violations', 'collides with a built-in');
    }
  });

  it('rejects malformed task IDs', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      BadName: {
        type: 'housekeeping',
        description: 'd',
        schedule: '0 3 * * *',
        branch: null,
        checkCommand: ['echo'],
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(result.error, 'customTasks.BadName', 'match ^[a-z0-9]');
    }
  });

  it('rejects contextFrom referencing unknown tasks', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      downstream: {
        type: 'housekeeping',
        description: 'd',
        schedule: '0 3 * * *',
        branch: null,
        checkCommand: ['echo'],
        contextFrom: ['ghost-task'],
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(
        result.error,
        'customTasks.downstream.contextFrom[0]',
        "unknown task 'ghost-task'"
      );
    }
  });

  it('rejects self-referential contextFrom (1-cycle)', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      selfref: {
        type: 'housekeeping',
        description: 'd',
        schedule: '0 3 * * *',
        branch: null,
        checkCommand: ['echo'],
        contextFrom: ['selfref'],
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(result.error, 'customTasks.selfref', 'cannot reference itself');
    }
  });

  it('rejects multi-hop contextFrom cycles', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      a: {
        type: 'housekeeping',
        description: 'd',
        schedule: '0 3 * * *',
        branch: null,
        checkCommand: ['echo'],
        contextFrom: ['b'],
      },
      b: {
        type: 'housekeeping',
        description: 'd',
        schedule: '0 3 * * *',
        branch: null,
        checkCommand: ['echo'],
        contextFrom: ['c'],
      },
      c: {
        type: 'housekeeping',
        description: 'd',
        schedule: '0 3 * * *',
        branch: null,
        checkCommand: ['echo'],
        contextFrom: ['a'],
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const cycleErr = result.error.find((e) => e.message.includes('cycle detected'));
      expect(cycleErr).toBeTruthy();
      // The cycle should mention all three nodes
      expect(cycleErr?.message).toMatch(/a/);
      expect(cycleErr?.message).toMatch(/b/);
      expect(cycleErr?.message).toMatch(/c/);
    }
  });

  it('accepts contextFrom referencing a built-in task', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      'after-arch': {
        type: 'housekeeping',
        description: 'd',
        schedule: '0 3 * * *',
        branch: null,
        checkCommand: ['echo'],
        contextFrom: ['arch-violations'],
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(true);
  });

  it('reports missing inlineSkills when skillExists is provided', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      inlined: {
        type: 'mechanical-ai',
        description: 'd',
        schedule: '0 3 * * *',
        branch: 'b',
        checkScript: { path: './x' },
        fixSkill: 's',
        inlineSkills: ['known-skill', 'missing-skill'],
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS, {
      skillExists: (n) => n === 'known-skill',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(result.error, 'customTasks.inlined.inlineSkills[1]', "'missing-skill' not found");
    }
  });

  it('reports missing checkScript path when scriptExists is provided', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      scripted: {
        type: 'mechanical-ai',
        description: 'd',
        schedule: '0 3 * * *',
        branch: 'b',
        checkScript: { path: './ghost' },
        fixSkill: 's',
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS, {
      scriptExists: () => false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(result.error, 'customTasks.scripted.checkScript.path', 'executable not found');
    }
  });

  it('reports multiple errors in a single pass', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      'kitchen-sink': {
        type: 'mechanical-ai',
        description: '',
        schedule: '',
        branch: null,
        // missing both check shapes too
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('accepts inlineSkillsBudgetTokens and contextFromMaxAgeMinutes positive integers', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      budgeted: {
        type: 'mechanical-ai',
        description: 'd',
        schedule: '0 3 * * *',
        branch: 'b',
        checkScript: { path: './x' },
        fixSkill: 's',
        inlineSkills: ['k'],
        inlineSkillsBudgetTokens: 4000,
        contextFrom: ['arch-violations'],
        contextFromMaxAgeMinutes: 60,
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS, { skillExists: () => true });
    expect(result.ok).toBe(true);
  });

  it('rejects non-positive contextFromMaxAgeMinutes', () => {
    const tasks: Record<string, CustomTaskDefinition> = {
      budgeted: {
        type: 'housekeeping',
        description: 'd',
        schedule: '0 3 * * *',
        branch: null,
        checkCommand: ['echo'],
        contextFromMaxAgeMinutes: 0,
      },
    };
    const result = validateCustomTasks(tasks, BUILT_INS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectError(
        result.error,
        'customTasks.budgeted.contextFromMaxAgeMinutes',
        'positive integer'
      );
    }
  });
});
