import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import type { CheckScriptDefinition } from '@harness-engineering/types';

const execFileAsync = promisify(execFile);

/**
 * Hermes Phase 2 — Result of running an arbitrary check script.
 *
 * Structurally compatible with `CheckCommandResult` (`task-runner.ts`) so
 * `TaskRunner` can consume it through the same interface, plus a parsed
 * structured envelope and the captured stderr stream. `structured` is
 * `null` when no JSON status line was found on stdout. The shape is
 * declared locally (not imported from `task-runner.ts`) to keep the
 * module dependency one-way: `task-runner.ts` depends on
 * `check-script-runner.ts`, never the reverse.
 */
export interface CheckScriptResult {
  passed: boolean;
  findings: number;
  /** Raw stdout. Field name matches `CheckCommandResult.output` for compatibility. */
  output: string;
  stderr: string;
  structured: CheckScriptStatusEnvelope | null;
}

export interface CheckScriptStatusEnvelope {
  status: 'ok' | 'findings' | 'skip' | 'error';
  findings?: number;
  wakeAgent?: boolean;
  message?: string;
  outputs?: Record<string, unknown>;
}

/**
 * Spawns an arbitrary executable for the mechanical/report/housekeeping
 * check step. Honors the structured JSON status envelope (last non-empty
 * stdout line) per Hermes Phase 2 D6. Falls back to the legacy heuristic
 * regex when no JSON envelope is present.
 *
 * The runner is intentionally simple and shells out via `execFile` (no
 * shell, no `sh -c`) — `args` are passed verbatim to avoid argument
 * injection from operator-supplied config.
 */
export class CheckScriptRunner {
  constructor(private cwd: string) {}

  async run(spec: CheckScriptDefinition, cwd?: string): Promise<CheckScriptResult> {
    const projectRoot = cwd ?? this.cwd;
    const captured = await captureScript(spec, projectRoot);
    const parseJson = spec.parseStdoutJson !== false;
    const structured = parseJson ? parseStatusEnvelope(captured.stdout) : null;
    if (structured) {
      return mapStructured(structured, captured.stdout, captured.stderr);
    }
    return heuristicResult(captured.stdout, captured.stderr, captured.exitedAbnormally);
  }
}

interface CapturedScript {
  stdout: string;
  stderr: string;
  exitedAbnormally: boolean;
}

async function captureScript(
  spec: CheckScriptDefinition,
  projectRoot: string
): Promise<CapturedScript> {
  const resolved = path.isAbsolute(spec.path) ? spec.path : path.resolve(projectRoot, spec.path);
  const args = spec.args ?? [];
  const timeoutMs = spec.timeoutMs ?? 120_000;
  try {
    const result = await execFileAsync(resolved, args, { cwd: projectRoot, timeout: timeoutMs });
    return {
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      exitedAbnormally: false,
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return {
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? ''),
      exitedAbnormally: true,
    };
  }
}

/**
 * Scan stdout from the last non-empty line backward; return the first line
 * that parses as a JSON object whose `status` field matches the
 * Phase 2 envelope vocabulary.
 */
export function parseStatusEnvelope(stdout: string): CheckScriptStatusEnvelope | null {
  const lines = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const env = classifyLine(lines[i]);
    if (env) return env;
  }
  return null;
}

const ENVELOPE_STATUSES = new Set(['ok', 'findings', 'skip', 'error']);

function classifyLine(line: string | undefined): CheckScriptStatusEnvelope | null {
  const obj = tryParseJsonObject(line);
  if (!obj) return null;
  const s = obj.status;
  if (typeof s !== 'string' || !ENVELOPE_STATUSES.has(s)) return null;
  return buildEnvelope(s as CheckScriptStatusEnvelope['status'], obj);
}

function tryParseJsonObject(line: string | undefined): Record<string, unknown> | null {
  if (!line || !line.startsWith('{') || !line.endsWith('}')) return null;
  try {
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildEnvelope(
  status: CheckScriptStatusEnvelope['status'],
  obj: Record<string, unknown>
): CheckScriptStatusEnvelope {
  const env: CheckScriptStatusEnvelope = { status };
  if (typeof obj.findings === 'number') env.findings = obj.findings;
  if (typeof obj.wakeAgent === 'boolean') env.wakeAgent = obj.wakeAgent;
  if (typeof obj.message === 'string') env.message = obj.message;
  if (obj.outputs && typeof obj.outputs === 'object') {
    env.outputs = obj.outputs as Record<string, unknown>;
  }
  return env;
}

function mapStructured(
  env: CheckScriptStatusEnvelope,
  stdout: string,
  stderr: string
): CheckScriptResult {
  const findings = env.findings ?? (env.status === 'findings' ? 1 : 0);
  switch (env.status) {
    case 'ok':
      return { passed: true, findings: 0, output: stdout, stderr, structured: env };
    case 'findings': {
      const wake = env.wakeAgent ?? findings > 0;
      // passed === false signals "dispatch the agent" to TaskRunner.
      return { passed: !wake, findings, output: stdout, stderr, structured: env };
    }
    case 'skip':
      return { passed: true, findings: 0, output: stdout, stderr, structured: env };
    case 'error':
      return {
        passed: false,
        findings: Math.max(findings, 1),
        output: stdout,
        stderr,
        structured: env,
      };
    default:
      return { passed: true, findings: 0, output: stdout, stderr, structured: env };
  }
}

function heuristicResult(
  stdout: string,
  stderr: string,
  exitedAbnormally: boolean
): CheckScriptResult {
  const combined = [stdout, stderr].filter(Boolean).join('\n');
  const findingsMatch = combined.match(/(\d+)\s+(?:finding|issue|violation|error)/i);
  const findings = findingsMatch ? parseInt(findingsMatch[1]!, 10) : exitedAbnormally ? 1 : 0;
  return {
    passed: findings === 0 && !exitedAbnormally,
    findings,
    output: stdout,
    stderr,
    structured: null,
  };
}
