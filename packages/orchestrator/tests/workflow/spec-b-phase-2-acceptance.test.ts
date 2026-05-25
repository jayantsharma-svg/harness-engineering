import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { WorkflowLoader } from '../../src/workflow/loader';
import { STANDARD_COGNITIVE_MODES } from '@harness-engineering/types';

/**
 * Spec B Phase 2 acceptance suite. Pins success criteria S2 + S3 + Q3 +
 * N4 + N5 end-to-end through `WorkflowLoader.loadWorkflow` (the entry
 * point for `harness orchestrator run` and `harness maintenance`).
 *
 * Each test simulates a real workflow markdown file on disk + a real
 * project skill catalog under `agents/skills/claude-code/`, so any
 * regression in the loader/validator/catalog-discovery pipeline shows up
 * here.
 */
describe('Spec B Phase 2 — full acceptance', () => {
  let tmpRoot: string;
  let workflowPath: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-2-accept-'));
    workflowPath = path.join(tmpRoot, 'harness.orchestrator.md');

    // Plant a small skill catalog.
    for (const name of ['harness-debugging', 'harness-soundness-review']) {
      const dir = path.join(tmpRoot, 'agents', 'skills', 'claude-code', name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'skill.yaml'), `name: ${name}\nversion: 1.0.0\n`);
    }
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  const writeWorkflow = (routingYaml: string): void => {
    fs.writeFileSync(
      workflowPath,
      [
        '---',
        'tracker: { kind: roadmap, filePath: docs/roadmap.md, activeStates: [], terminalStates: [] }',
        'polling: { intervalMs: 1000, jitterMs: 0 }',
        'workspace: { root: .harness/workspaces }',
        'hooks: { afterCreate: null, beforeRun: null, afterRun: null, beforeRemove: null, timeoutMs: 1000 }',
        'agent:',
        '  backends:',
        '    claude-opus: { type: claude }',
        '    claude-sonnet: { type: claude }',
        '  routing:',
        routingYaml,
        'server: { port: 8080 }',
        '---',
        'PROMPT',
      ].join('\n')
    );
  };

  // ---------------- S2: hard errors -----------------------------------

  it('S2: rejects routing.skills chain entry referencing an unknown backend (Q3 message format)', async () => {
    writeWorkflow(
      '    default: claude-opus\n    skills:\n      harness-debugging: [claude-opus, typo-backend]'
    );
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Q3: error must name the offending path and the known backend list.
    expect(result.error.message).toContain('routing.skills.harness-debugging.1');
    expect(result.error.message).toContain('typo-backend');
    expect(result.error.message).toContain('claude-opus');
    expect(result.error.message).toContain('claude-sonnet');
  });

  it('S2: rejects routing.modes scalar referencing an unknown backend', async () => {
    writeWorkflow('    default: claude-opus\n    modes:\n      adversarial-reviewer: typo-backend');
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('routing.modes.adversarial-reviewer');
    expect(result.error.message).toContain('typo-backend');
  });

  it('S2: rejects routing.isolation chain entry referencing an unknown backend (closes I2)', async () => {
    writeWorkflow(
      '    default: claude-opus\n    isolation:\n      container: [claude-opus, typo-backend]'
    );
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('routing.isolation.container.1');
    expect(result.error.message).toContain('typo-backend');
  });

  it('S2: rejects widened-scalar field (e.g., routing.default chain) referencing an unknown backend', async () => {
    writeWorkflow('    default: [claude-opus, typo-backend]');
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('routing.default.1');
    expect(result.error.message).toContain('typo-backend');
  });

  // ---------------- S3: warnings (non-blocking) -----------------------

  it('S3: warns on routing.skills.<name> not in the local catalog', async () => {
    writeWorkflow('    default: claude-opus\n    skills:\n      harness-debuggin: claude-opus');
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings.some((w) => w.includes('routing.skills.harness-debuggin'))).toBe(
      true
    );
  });

  it('S3: warns on routing.modes.<mode> not in STANDARD_COGNITIVE_MODES (lists the standard set)', async () => {
    writeWorkflow('    default: claude-opus\n    modes:\n      gut-reactor: claude-opus');
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const modeWarning = result.value.warnings.find((w) => w.includes('routing.modes.gut-reactor'));
    expect(modeWarning).toBeDefined();
    for (const standard of STANDARD_COGNITIVE_MODES) {
      expect(modeWarning).toContain(standard);
    }
  });

  it('S3: does NOT warn when every routing.skills.<name> is in the catalog AND every mode is standard', async () => {
    writeWorkflow(
      '    default: claude-opus\n    skills:\n      harness-debugging: claude-opus\n    modes:\n      adversarial-reviewer: claude-opus'
    );
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toEqual([]);
  });

  // ---------------- N4 / N5: no regression ----------------------------

  it('N4: a config with no routing.skills/routing.modes loads cleanly with no warnings', async () => {
    writeWorkflow('    default: claude-opus\n    quick-fix: claude-sonnet');
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toEqual([]);
  });

  it('N5: array form on a previously-scalar routing field loads cleanly', async () => {
    writeWorkflow('    default: [claude-opus, claude-sonnet]');
    const result = await new WorkflowLoader().loadWorkflow(workflowPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toEqual([]);
  });
});
