/**
 * `PoolStateStore` — atomic on-disk persistence for `PoolState`.
 *
 * Mirrors `HuggingFaceCache`'s pattern: an in-memory map, a `Filesystem`
 * port for testability, atomic `writeFile(tmp) → rename` semantics, and
 * graceful degradation when the file is missing, malformed, or schema-
 * mismatched (no throws — every failure mode degrades to an empty state and
 * emits a single structured warning).
 *
 * Phase 3a ships the persistence primitive only. Phase 3b's `PoolManager`
 * is the first non-test consumer; it wraps this store and orchestrates
 * install / evict against the Ollama REST adapter.
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md
 *      Phase 3 (lines 431–443); O2 atomicity invariant; S5 budget enforcement
 *      relies on this store's `update` round-trip to keep `diskUsedGb` honest.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { EmptyPoolState, type PoolEntry, type PoolState } from './types.js';

/** Schema version of the persisted file. Bumped when the on-disk shape changes. */
export const POOL_STATE_VERSION = 1;

/** Default on-disk pool path. Mirrors `~/.harness/local-models/` from the spec. */
export const DEFAULT_POOL_STATE_PATH = join(homedir(), '.harness', 'local-models', 'pool.json');

/** Envelope written to disk — `version` lets a future migration distinguish layouts. */
export interface PoolStateFile {
  version: number;
  state: PoolState;
}

/**
 * Narrow filesystem surface the store needs. Tests substitute an in-memory
 * implementation; production uses `node:fs/promises`.
 */
export interface PoolFilesystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
}

const defaultFs: PoolFilesystem = {
  readFile: (path) => readFile(path, 'utf-8'),
  writeFile: (path, contents) => writeFile(path, contents, 'utf-8'),
  rename: (from, to) => rename(from, to),
  mkdir: (path, options) => mkdir(path, options).then(() => undefined),
};

/** Optional clock + filesystem + warn sink — every default falls through to production. */
export interface PoolStateStoreOptions {
  /** Absolute path to the pool file. Defaults to `~/.harness/local-models/pool.json`. */
  path?: string;
  /** Clock for testability. Defaults to `Date.now`. */
  now?: () => number;
  /** Filesystem port. Defaults to `node:fs/promises` adapter. */
  fs?: PoolFilesystem;
  /** Optional structured logger; defaults to a silent no-op. */
  onWarn?: (message: string, cause?: unknown) => void;
}

/**
 * Versioned, atomically-persisted pool state. The flow is:
 *
 *   const store = new PoolStateStore({ path });
 *   await store.load();          // hydrate (idempotent; degrades to empty)
 *   store.update(s => ({ ...s, entries: [...s.entries, entry] }));
 *   await store.persist();        // atomic tmp + rename
 *
 * Mutations are synchronous — only `load` and `persist` touch the disk.
 */
export class PoolStateStore {
  private readonly path: string;
  // `now` is reserved for future timestamp-stamping during `update`; kept on
  // the ctor so the call site doesn't change when we start consuming it.
  private readonly now: () => number;
  private readonly fs: PoolFilesystem;
  private readonly onWarn: (message: string, cause?: unknown) => void;
  private state: PoolState = EmptyPoolState();
  private loaded = false;

  constructor(options: PoolStateStoreOptions = {}) {
    this.path = options.path ?? DEFAULT_POOL_STATE_PATH;
    this.now = options.now ?? (() => Date.now());
    this.fs = options.fs ?? defaultFs;
    this.onWarn = options.onWarn ?? (() => undefined);
    void this.now; // referenced to make TS happy until Phase 3b consumes it
  }

  /**
   * Hydrate the in-memory state from the on-disk file. Idempotent — repeated
   * calls are no-ops. Tolerates: missing file (no warn — first run), malformed
   * JSON, schema-version mismatch, shape mismatch. None of those throw; all
   * reset the state to `EmptyPoolState()` and (except missing file) emit a
   * structured warning.
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    let raw: string;
    try {
      raw = await this.fs.readFile(this.path);
    } catch (err) {
      if (isNotFound(err)) {
        this.state = EmptyPoolState();
        return;
      }
      this.onWarn(`pool state read failed at ${this.path}`, err);
      this.state = EmptyPoolState();
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.onWarn(`pool state file is not valid JSON at ${this.path}`, err);
      this.state = EmptyPoolState();
      return;
    }
    if (!isPoolStateFile(parsed)) {
      this.onWarn(`pool state file has an unexpected shape at ${this.path}`);
      this.state = EmptyPoolState();
      return;
    }
    if (parsed.version !== POOL_STATE_VERSION) {
      this.onWarn(
        `pool state schema version ${String(parsed.version)} at ${this.path} ` +
          `does not match expected ${String(POOL_STATE_VERSION)}; ignoring on-disk record`
      );
      this.state = EmptyPoolState();
      return;
    }
    this.state = cloneState(parsed.state);
  }

  /** Snapshot of the current state. Returned by value so callers can't mutate internals. */
  snapshot(): PoolState {
    return cloneState(this.state);
  }

  /**
   * Replace the current state via a pure mutator. The mutator is handed a
   * deep clone so it cannot accidentally retain a reference to internal
   * storage; the returned state becomes the new in-memory record.
   *
   * After every call, `diskUsedGb` is re-derived from the entry sum so
   * callers can't drift the field away from the truth on disk. `lastRefreshAt`
   * is left to the mutator.
   */
  update(mutator: (state: PoolState) => PoolState): void {
    const next = mutator(cloneState(this.state));
    this.state = {
      ...next,
      entries: next.entries.map(cloneEntry),
      diskUsedGb: sumDiskGb(next.entries),
    };
  }

  /**
   * Atomically persist the current state to disk. Writes `${path}.tmp` first
   * and then renames; on POSIX (and Windows when src + dst share a volume),
   * `rename` is atomic, so a crash between write and rename leaves the
   * previous good file intact (proposal O2).
   */
  async persist(): Promise<void> {
    const file: PoolStateFile = {
      version: POOL_STATE_VERSION,
      state: this.state,
    };
    const tmp = `${this.path}.tmp`;
    await this.fs.mkdir(dirname(this.path), { recursive: true });
    await this.fs.writeFile(tmp, JSON.stringify(file, null, 2));
    await this.fs.rename(tmp, this.path);
  }
}

/**
 * Type guard for the persisted envelope. Defensive enough that a hand-edited
 * file with a missing field or wrong type degrades to "empty state + warn"
 * rather than throwing.
 */
export function isPoolStateFile(value: unknown): value is PoolStateFile {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.version !== 'number') return false;
  const state = obj.state;
  if (typeof state !== 'object' || state === null) return false;
  const s = state as Record<string, unknown>;
  if (typeof s.diskBudgetGb !== 'number') return false;
  if (typeof s.diskUsedGb !== 'number') return false;
  if (!Array.isArray(s.entries)) return false;
  if (!Array.isArray(s.allowedOrgs)) return false;
  if (!Array.isArray(s.allowedFamilies)) return false;
  if (s.lastRefreshAt !== null && typeof s.lastRefreshAt !== 'string') return false;
  return s.entries.every(isPoolEntry);
}

function isPoolEntry(value: unknown): value is PoolEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.ollamaName === 'string' &&
    typeof e.hfRepoId === 'string' &&
    typeof e.sizeOnDiskGb === 'number' &&
    typeof e.installedAt === 'string' &&
    (e.lastUsedAt === null || typeof e.lastUsedAt === 'string') &&
    typeof e.currentScore === 'number'
  );
}

function cloneEntry(entry: PoolEntry): PoolEntry {
  return { ...entry };
}

function cloneState(state: PoolState): PoolState {
  return {
    diskBudgetGb: state.diskBudgetGb,
    diskUsedGb: state.diskUsedGb,
    entries: state.entries.map(cloneEntry),
    allowedOrgs: [...state.allowedOrgs],
    allowedFamilies: [...state.allowedFamilies],
    lastRefreshAt: state.lastRefreshAt,
  };
}

function sumDiskGb(entries: PoolEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.sizeOnDiskGb, 0);
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

/** Internal accessor for tests; not exported from the package barrel. */
export const __testing = { POOL_STATE_VERSION, EmptyPoolState };
