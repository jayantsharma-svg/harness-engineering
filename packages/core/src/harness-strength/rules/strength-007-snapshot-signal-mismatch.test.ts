import { describe, it, expect } from 'vitest';
import { CHECK_SIGNAL_MAP } from './strength-007-snapshot-signal-mismatch';

describe('STRENGTH-007 CHECK_SIGNAL_MAP', () => {
  it('maps each check to its contradicting signal name', () => {
    expect(CHECK_SIGNAL_MAP).toEqual({
      security: 'security-findings',
      entropy: 'entropy-drift',
      deps: 'dependency-violations',
      perf: 'perf-regression',
      docs: 'doc-coverage',
      lint: 'lint-issues',
    });
  });
});
