/**
 * End-to-end strictness matrix test.
 *
 * Exercises the full pipeline at all three `design.strictness` levels
 * against the same ANAT-D001 fixture (Button missing `content` slot)
 * and verifies the emitted severity matches the matrix in
 * `findings/severity.ts`.
 *
 *   ANAT-D001 default = error
 *     strict     → error
 *     standard   → error
 *     permissive → warn
 *
 * This proves `runAudit({ designStrictness })` threads the value all
 * the way through the convention runner. Without that wire, the runner
 * falls back to a static 'standard' severity and the matrix is invisible
 * to downstream consumers (harness validate, the MCP tool, the graph
 * VIOLATES edges).
 *
 * Refs: docs/changes/design-pipeline/audit-component-anatomy/proposal.md
 *  § Success Criteria SC-11 (harness validate respects design.strictness).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runAudit } from '../../../../src/mcp/tools/audit-anatomy';

const positiveButtonSource = `
interface ButtonProps {
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  // No content-satisfying member — ANAT-D001 fires.
}

export const Button = ({ onClick, variant }: ButtonProps) => (
  <button onClick={onClick} className={variant} />
);
`;

describe('audit-anatomy strictness matrix end-to-end', () => {
  let projectRoot: string;

  beforeAll(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-anatomy-strictness-'));
    fs.writeFileSync(path.join(projectRoot, 'Button.tsx'), positiveButtonSource, 'utf8');
  });

  afterAll(() => {
    if (projectRoot && fs.existsSync(projectRoot)) {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('emits ANAT-D001 as error at strict', async () => {
    const result = await runAudit({
      path: projectRoot,
      files: ['Button.tsx'],
      designStrictness: 'strict',
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.severity).toBe('error');
    expect(result.summary.bySeverity.error).toBe(1);
  });

  it('emits ANAT-D001 as error at standard (default)', async () => {
    const result = await runAudit({
      path: projectRoot,
      files: ['Button.tsx'],
      designStrictness: 'standard',
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.severity).toBe('error');
  });

  it('softens ANAT-D001 to warn at permissive', async () => {
    const result = await runAudit({
      path: projectRoot,
      files: ['Button.tsx'],
      designStrictness: 'permissive',
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.severity).toBe('warn');
    expect(result.summary.bySeverity.warn).toBe(1);
    expect(result.summary.bySeverity.error).toBe(0);
  });

  it('defaults to standard severity when strictness is omitted', async () => {
    const result = await runAudit({
      path: projectRoot,
      files: ['Button.tsx'],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.severity).toBe('error');
  });
});
