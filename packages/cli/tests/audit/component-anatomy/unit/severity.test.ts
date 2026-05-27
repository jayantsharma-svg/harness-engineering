/**
 * Severity matrix test.
 *
 * The matrix is table-driven so future audits can adopt it verbatim
 * (ADR draft 0020 — cross-skill severity consistency). Each row asserts
 * one (defaultSeverity, strictness) → emittedSeverity transition.
 *
 *   defaultSeverity:           error    warn    info
 *   strictness=strict      →   error    error   info
 *   strictness=standard    →   error    warn    info
 *   strictness=permissive  →   warn     info    info
 *
 * Refs: docs/changes/design-pipeline/audit-component-anatomy/proposal.md
 *  § Implementation Order → Phase 3.1.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveSeverity,
  defaultSeverityForCode,
} from '../../../../src/audit/component-anatomy/findings/severity.js';
import type { Severity } from '../../../../src/audit/component-anatomy/findings/finding.js';
import type { DesignStrictness } from '../../../../src/audit/component-anatomy/findings/severity.js';

describe('resolveSeverity matrix', () => {
  const matrix: Array<{ default: Severity; strictness: DesignStrictness; expected: Severity }> = [
    { default: 'error', strictness: 'strict', expected: 'error' },
    { default: 'warn', strictness: 'strict', expected: 'error' },
    { default: 'info', strictness: 'strict', expected: 'info' },

    { default: 'error', strictness: 'standard', expected: 'error' },
    { default: 'warn', strictness: 'standard', expected: 'warn' },
    { default: 'info', strictness: 'standard', expected: 'info' },

    { default: 'error', strictness: 'permissive', expected: 'warn' },
    { default: 'warn', strictness: 'permissive', expected: 'info' },
    { default: 'info', strictness: 'permissive', expected: 'info' },
  ];

  for (const row of matrix) {
    it(`${row.strictness} × ${row.default} → ${row.expected}`, () => {
      expect(resolveSeverity(row.default, row.strictness)).toBe(row.expected);
    });
  }

  it('defaults to standard when strictness is omitted', () => {
    expect(resolveSeverity('warn')).toBe('warn');
    expect(resolveSeverity('error')).toBe('error');
    expect(resolveSeverity('info')).toBe('info');
  });
});

describe('defaultSeverityForCode tier bands', () => {
  it('ANAT-D000 is info (authoring divergence guidance)', () => {
    expect(defaultSeverityForCode('ANAT-D000')).toBe('info');
  });

  it('ANAT-D001..D029 is error (Tier-1 critical)', () => {
    expect(defaultSeverityForCode('ANAT-D001')).toBe('error');
    expect(defaultSeverityForCode('ANAT-D015')).toBe('error');
    expect(defaultSeverityForCode('ANAT-D029')).toBe('error');
  });

  it('ANAT-D030..D099 is warn (Tier-2 important)', () => {
    expect(defaultSeverityForCode('ANAT-D030')).toBe('warn');
    expect(defaultSeverityForCode('ANAT-D099')).toBe('warn');
  });

  it('ANAT-D100..D199 is info (Tier-3 advisory)', () => {
    expect(defaultSeverityForCode('ANAT-D100')).toBe('info');
    expect(defaultSeverityForCode('ANAT-D199')).toBe('info');
  });

  it('ANAT-P001..P099 is warn (pattern-presence default)', () => {
    expect(defaultSeverityForCode('ANAT-P001')).toBe('warn');
    expect(defaultSeverityForCode('ANAT-P099')).toBe('warn');
  });

  it('ANAT-P100..P199 is info (pattern-presence advisory)', () => {
    expect(defaultSeverityForCode('ANAT-P100')).toBe('info');
    expect(defaultSeverityForCode('ANAT-P199')).toBe('info');
  });

  it('unknown codes default to warn (conservative)', () => {
    expect(defaultSeverityForCode('ANAT-X999')).toBe('warn');
    expect(defaultSeverityForCode('NOT-A-CODE')).toBe('warn');
  });
});

describe('resolveSeverity composed with defaultSeverityForCode', () => {
  // End-to-end: a Tier-1 D001 finding at standard strictness should
  // stay error; at permissive should soften to warn; at strict should
  // remain error (already at the top of the matrix).
  it('ANAT-D001 emits error/error/warn across strict/standard/permissive', () => {
    const base = defaultSeverityForCode('ANAT-D001');
    expect(resolveSeverity(base, 'strict')).toBe('error');
    expect(resolveSeverity(base, 'standard')).toBe('error');
    expect(resolveSeverity(base, 'permissive')).toBe('warn');
  });

  it('ANAT-P001 emits error/warn/info across strict/standard/permissive', () => {
    const base = defaultSeverityForCode('ANAT-P001');
    expect(resolveSeverity(base, 'strict')).toBe('error');
    expect(resolveSeverity(base, 'standard')).toBe('warn');
    expect(resolveSeverity(base, 'permissive')).toBe('info');
  });
});
