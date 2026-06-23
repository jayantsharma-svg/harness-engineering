import { describe, it, expect } from 'vitest';
import {
  StrengthFindingSchema,
  ProjectContextSchema,
  AuditResultSchema,
  HarnessConfigSubsetSchema,
} from './types';

describe('StrengthFindingSchema', () => {
  it('accepts a valid finding without optional line', () => {
    const r = StrengthFindingSchema.safeParse({
      id: 'STRENGTH-001',
      gearPiece: 'hooks',
      severity: 'error',
      file: '.husky/pre-commit',
      message: 'hook never blocks',
      remediation: 'remove the unconditional exit 0',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown severity', () => {
    const r = StrengthFindingSchema.safeParse({
      id: 'X',
      gearPiece: 'g',
      severity: 'fatal',
      file: 'f',
      message: 'm',
      remediation: 'r',
    });
    expect(r.success).toBe(false);
  });
});

describe('HarnessConfigSubsetSchema', () => {
  it('passes through unknown top-level keys', () => {
    const r = HarnessConfigSubsetSchema.safeParse({
      unknownKey: 1,
      template: { level: 'basic' },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.template?.level).toBe('basic');
  });
});

describe('ProjectContextSchema', () => {
  it('accepts a minimal adopter context with absent inputs', () => {
    const r = ProjectContextSchema.safeParse({
      root: '/x',
      mode: 'adopter',
      config: null,
      preCommit: null,
      hookFiles: [],
      workflows: [],
      healthSnapshot: null,
    });
    expect(r.success).toBe(true);
  });
});

describe('AuditResultSchema', () => {
  it('rejects a score above 100', () => {
    const r = AuditResultSchema.safeParse({
      mode: 'adopter',
      score: 101,
      tier: 'solid',
      findings: [],
      summary: { errors: 0, warnings: 0, info: 0, rulesRun: 0, rulesPassing: 0 },
    });
    expect(r.success).toBe(false);
  });
});
