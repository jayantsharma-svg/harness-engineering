import { describe, it, expect } from 'vitest';
import { deriveAuthority } from '../../src/outcome-eval/authority.js';
import type { Verdict, Confidence } from '../../src/outcome-eval/types.js';

const VERDICTS: Verdict[] = ['SATISFIED', 'NOT_SATISFIED', 'INCONCLUSIVE'];
const CONFIDENCES: Confidence[] = ['low', 'medium', 'high'];

describe('deriveAuthority', () => {
  it('is blocking iff NOT_SATISFIED + high', () => {
    expect(deriveAuthority('NOT_SATISFIED', 'high')).toBe('blocking');
  });

  it('is advisory for every other verdict×confidence pair (8 of 9)', () => {
    for (const v of VERDICTS) {
      for (const c of CONFIDENCES) {
        const expected = v === 'NOT_SATISFIED' && c === 'high' ? 'blocking' : 'advisory';
        expect(deriveAuthority(v, c)).toBe(expected);
      }
    }
  });

  it('INCONCLUSIVE is always advisory regardless of confidence (Criterion 3)', () => {
    for (const c of CONFIDENCES) {
      expect(deriveAuthority('INCONCLUSIVE', c)).toBe('advisory');
    }
  });

  it('SATISFIED is always advisory regardless of confidence', () => {
    for (const c of CONFIDENCES) {
      expect(deriveAuthority('SATISFIED', c)).toBe('advisory');
    }
  });
});
