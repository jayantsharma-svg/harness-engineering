import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OutputRetentionConfig } from '@harness-engineering/types';
import type { RunResult, RunOrigin } from './types';
import type { MaintenanceLogger } from './scheduler';

/**
 * Hermes Phase 2 — A single persisted run entry.
 *
 * Mirrors `RunResult` plus the captured stdout/stderr, the parsed structured
 * status envelope (if any), the resolved upstream context that was injected
 * into the prompt (if any), and the trigger origin.
 */
export interface PersistedOutputEntry {
  taskId: string;
  startedAt: string;
  completedAt: string;
  status: RunResult['status'];
  findings: number;
  fixed: number;
  prUrl: string | null;
  prUpdated: boolean;
  error?: string;
  costUsd?: number;
  origin?: RunOrigin;
  /** Raw captured stdout from the check step (or housekeeping command). */
  stdout?: string;
  /** Raw captured stderr from the check step. */
  stderr?: string;
  /** Structured envelope when a JSON status line was parsed; null otherwise. */
  structured?: Record<string, unknown> | null;
  /** Resolved upstream-context block, if any. */
  context?: string;
}

export interface TaskOutputStoreOptions {
  /** Root directory under which `<taskId>/outputs/` lives. Default: `.harness/maintenance`. */
  rootDir: string;
  /** Default retention bounds applied when a task doesn't specify its own. */
  retentionDefaults?: Required<OutputRetentionConfig>;
  logger?: MaintenanceLogger;
}

const DEFAULT_RETENTION: Required<OutputRetentionConfig> = {
  runs: 50,
  maxAgeDays: 30,
};

const fallbackLogger: MaintenanceLogger = {
  info: () => {},
  warn: (m, c) => console.warn(m, c),
  error: (m, c) => console.error(m, c),
};

/**
 * Persists per-task run outputs to disk and applies retention. The store is
 * intentionally simple: one file per run keyed by completion timestamp, JSON
 * payload, no SQLite. The chain-context read path (`latest`) and the
 * dashboard list path (`list`) both consume the same on-disk format.
 *
 * Concurrency: `processQueue` already serializes runs of the same task ID,
 * so the store assumes exclusive write access per task.
 */
export class TaskOutputStore {
  private rootDir: string;
  private retentionDefaults: Required<OutputRetentionConfig>;
  private logger: MaintenanceLogger;

  constructor(options: TaskOutputStoreOptions) {
    this.rootDir = options.rootDir;
    this.retentionDefaults = options.retentionDefaults ?? DEFAULT_RETENTION;
    this.logger = options.logger ?? fallbackLogger;
  }

  /**
   * Reject task IDs that don't match the validator's kebab-case pattern —
   * defends `dirFor()` against caller-supplied path-traversal segments
   * (`'../foo'`) when the store is invoked from CLI surfaces that don't
   * round-trip through `validateCustomTasks`.
   */
  private ensureSafeTaskId(taskId: string): void {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(taskId)) {
      throw new Error(
        `TaskOutputStore: invalid task id '${taskId}' (must match ^[a-z0-9][a-z0-9-]*$)`
      );
    }
  }

  /**
   * Persist a single run entry. Retention is applied after the write so
   * the latest record is durable even if pruning fails.
   */
  async write(
    taskId: string,
    entry: PersistedOutputEntry,
    retention?: OutputRetentionConfig
  ): Promise<void> {
    this.ensureSafeTaskId(taskId);
    const dir = this.dirFor(taskId);
    await fs.promises.mkdir(dir, { recursive: true });

    const fileName = `${sanitizeIso(entry.completedAt || new Date().toISOString())}.json`;
    const filePath = path.join(dir, fileName);
    const tmpPath = `${filePath}.tmp`;
    const payload = JSON.stringify(entry, null, 2);
    await fs.promises.writeFile(tmpPath, payload, 'utf-8');
    await fs.promises.rename(tmpPath, filePath);

    try {
      await this.applyRetention(taskId, retention);
    } catch (err) {
      this.logger.warn('TaskOutputStore retention failed', { taskId, error: String(err) });
    }
  }

  /**
   * Return the most recent persisted entry for the task, or null if none.
   */
  async latest(taskId: string): Promise<PersistedOutputEntry | null> {
    const entries = await this.list(taskId, 1, 0);
    return entries[0] ?? null;
  }

  /**
   * List entries newest-first with offset+limit pagination.
   */
  async list(taskId: string, limit: number, offset: number): Promise<PersistedOutputEntry[]> {
    this.ensureSafeTaskId(taskId);
    const dir = this.dirFor(taskId);
    const fileNames = await listJsonFilesDescending(dir);
    const slice = fileNames.slice(offset, offset + limit);
    const out: PersistedOutputEntry[] = [];
    for (const name of slice) {
      const entry = await this.readEntry(path.join(dir, name));
      if (entry) out.push(entry);
    }
    return out;
  }

  /**
   * Lookup a specific run by its file name (without the `.json` suffix) or
   * by its raw completion timestamp.
   */
  async get(taskId: string, runId: string): Promise<PersistedOutputEntry | null> {
    this.ensureSafeTaskId(taskId);
    if (/[\\/]|\.\./.test(runId)) {
      throw new Error(`TaskOutputStore: runId '${runId}' must not contain path separators or '..'`);
    }
    const dir = this.dirFor(taskId);
    const fileName = runId.endsWith('.json') ? runId : `${sanitizeIso(runId)}.json`;
    return this.readEntry(path.join(dir, fileName));
  }

  /**
   * The on-disk root for a given task. Exposed for tooling that needs to walk
   * outputs from outside the store API.
   */
  dirFor(taskId: string): string {
    return path.join(this.rootDir, taskId, 'outputs');
  }

  private async readEntry(filePath: string): Promise<PersistedOutputEntry | null> {
    try {
      const buf = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(buf) as PersistedOutputEntry;
      return parsed;
    } catch {
      // missing / unreadable / corrupt — skip silently for callers; load
      // path is best-effort
      return null;
    }
  }

  private async applyRetention(
    taskId: string,
    retention: OutputRetentionConfig | undefined
  ): Promise<void> {
    const runs = retention?.runs ?? this.retentionDefaults.runs;
    const maxAgeDays = retention?.maxAgeDays ?? this.retentionDefaults.maxAgeDays;

    const dir = this.dirFor(taskId);
    const fileNames = await listJsonFilesDescending(dir);

    const overflow = fileNames.slice(runs);

    const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const aged: string[] = [];
    for (const name of fileNames) {
      const ts = parseIsoFromFileName(name);
      if (ts !== null && ts < cutoffMs) aged.push(name);
    }

    const toRemove = new Set<string>([...overflow, ...aged]);
    for (const name of toRemove) {
      try {
        await fs.promises.unlink(path.join(dir, name));
      } catch {
        // ignore — file may have been removed by another sweep
      }
    }
  }
}

/**
 * Filenames are `<sanitized-iso>.json`. Sorting by name is sufficient because
 * the sanitization is monotonic-friendly (`:` → `-` preserves lexicographic
 * order across timestamps).
 */
async function listJsonFilesDescending(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith('.json'))
    .sort()
    .reverse();
}

function sanitizeIso(iso: string): string {
  return iso.replace(/:/g, '-');
}

function parseIsoFromFileName(fileName: string): number | null {
  const stem = fileName.replace(/\.json$/, '');
  // Sanitized format: 2026-05-17T14-00-00.000Z (original ':' replaced with '-')
  const restored = stem.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
  const ms = Date.parse(restored);
  return Number.isFinite(ms) ? ms : null;
}
