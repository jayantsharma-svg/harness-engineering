import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Mock the pipeline so NO real review runs. The orchestrator only depends on its
// ReviewPipelineResult shape (skipped / stoppedByMechanical / assessment / findings).
// vi.hoisted lets the mock fn exist before the hoisted vi.mock factory references it.
const { runReviewPipeline } = vi.hoisted(() => ({ runReviewPipeline: vi.fn() }));
vi.mock('../../../src/review/pipeline-orchestrator', () => ({ runReviewPipeline }));

// Imported AFTER vi.mock so the mock is in place.
import { runCiReview, type ExecFileLike } from '../../../src/review/ci/orchestrator';

const fx = (name: string): string => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

// A DiffInfo stub — only fileDiffs is read by the orchestrator (for the STDIN string).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const diff = { fileDiffs: new Map([['src/x.ts', 'diff --git a/src/x.ts b/src/x.ts']]) } as any;

const floorClean = {
  skipped: false,
  stoppedByMechanical: false,
  assessment: 'approve' as const,
  findings: [],
  strengths: [],
  terminalOutput: '',
  githubComments: [],
  exitCode: 0,
};

const floorMechStop = {
  skipped: false,
  stoppedByMechanical: true,
  assessment: 'request-changes' as const,
  findings: [],
  strengths: [],
  terminalOutput: '',
  githubComments: [],
  exitCode: 1,
};

// A fully-formed critical ReviewFinding the floor can emit.
const criticalFloorFinding = {
  id: 'floor-crit-1',
  file: 'src/x.ts',
  lineRange: [1, 2] as [number, number],
  domain: 'security' as const,
  severity: 'critical' as const,
  title: 'Floor critical',
  rationale: 'A heuristic critical from the floor.',
  evidence: ['src/x.ts:1'],
  validatedBy: 'mechanical' as const,
};

beforeEach(() => {
  runReviewPipeline.mockReset();
});

describe('runCiReview — SC1 (floor-only gating)', () => {
  it('floor-only clean diff → exitCode 0, runner floor-only, ranLlmTier false, no seam call', async () => {
    runReviewPipeline.mockResolvedValue(floorClean);
    const execFile = vi.fn();
    const r = await runCiReview({ projectRoot: '/p', diff, execFile });
    expect(execFile).not.toHaveBeenCalled();
    expect(r.exitCode).toBe(0);
    expect(r.verdict.runner).toBe('floor-only');
    expect(r.ranLlmTier).toBe(false);
  });

  it('floor mechanical-stop short-circuits → exitCode 1, ranLlmTier false, seam NEVER called', async () => {
    runReviewPipeline.mockResolvedValue(floorMechStop);
    const execFile = vi.fn();
    const r = await runCiReview({
      projectRoot: '/p',
      diff,
      runner: 'claude',
      env: { ANTHROPIC_API_KEY: 'x' },
      execFile,
    });
    expect(execFile).not.toHaveBeenCalled();
    expect(r.exitCode).toBe(1);
    expect(r.ranLlmTier).toBe(false);
    expect(r.verdict.runner).toBe('floor-only');
    expect(r.llmSkipReason).toMatch(/mechanical-stop/);
  });

  it('floor with a critical heuristic finding → exitCode 1', async () => {
    runReviewPipeline.mockResolvedValue({
      ...floorClean,
      assessment: 'request-changes',
      findings: [criticalFloorFinding],
    });
    const r = await runCiReview({ projectRoot: '/p', diff });
    expect(r.exitCode).toBe(1);
    expect(r.verdict.assessment).toBe('request-changes');
    expect(r.verdict.blockingFindings).toHaveLength(1);
  });
});

describe('runCiReview — SC2 (secret-gated LLM tier + graceful skip)', () => {
  it('secret present → seam invoked with diff on STDIN, ranLlmTier true, claude findings merged', async () => {
    runReviewPipeline.mockResolvedValue(floorClean);
    const execFile: ExecFileLike = vi.fn().mockResolvedValue({ stdout: fx('claude-verdict.json') });
    const r = await runCiReview({
      projectRoot: '/p',
      diff,
      runner: 'claude',
      env: { ANTHROPIC_API_KEY: 'x' },
      execFile,
    });
    expect(execFile).toHaveBeenCalledOnce();
    // diff piped to STDIN:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((execFile as any).mock.calls[0][2].stdin).toContain('diff --git');
    // command from the claude preset:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((execFile as any).mock.calls[0][0]).toBe('claude');
    expect(r.ranLlmTier).toBe(true);
    expect(r.verdict.runner).toBe('claude');
    expect(r.verdict.findings.length).toBeGreaterThan(0); // claude fixture has 1 critical
    expect(r.llmSkipReason).toBeUndefined();
  });

  it('secret absent → graceful skip, ranLlmTier false, llmSkipReason set, seam NOT called, no throw', async () => {
    runReviewPipeline.mockResolvedValue(floorClean);
    const execFile = vi.fn();
    const r = await runCiReview({ projectRoot: '/p', diff, runner: 'claude', env: {}, execFile });
    expect(execFile).not.toHaveBeenCalled();
    expect(r.ranLlmTier).toBe(false);
    expect(r.llmSkipReason).toMatch(/secret ANTHROPIC_API_KEY/);
    expect(r.verdict.runner).toBe('floor-only');
    expect(r.exitCode).toBe(0);
  });

  it('unsupported runner (cursor) → graceful skip with unsupported reason, no throw', async () => {
    runReviewPipeline.mockResolvedValue(floorClean);
    const execFile = vi.fn();
    const r = await runCiReview({
      projectRoot: '/p',
      diff,
      runner: 'cursor',
      env: { ANYTHING: 'x' },
      execFile,
    });
    expect(execFile).not.toHaveBeenCalled();
    expect(r.ranLlmTier).toBe(false);
    expect(r.llmSkipReason).toMatch(/unsupported/);
    expect(r.verdict.runner).toBe('floor-only');
  });

  it('endpoint runner with no localInvoke → graceful skip', async () => {
    runReviewPipeline.mockResolvedValue(floorClean);
    const r = await runCiReview({
      projectRoot: '/p',
      diff,
      runner: 'local',
      env: { HARNESS_LOCAL_ENDPOINT: 'http://x', HARNESS_LOCAL_MODEL: 'm' },
      // no localInvoke — the preset's invoke is unset
    });
    expect(r.ranLlmTier).toBe(false);
    expect(r.llmSkipReason).toMatch(/local endpoint not configured/);
    expect(r.verdict.runner).toBe('floor-only');
  });
});
