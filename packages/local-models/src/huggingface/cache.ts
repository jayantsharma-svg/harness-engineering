/**
 * `HuggingFaceCache` — in-memory + on-disk cache for HF responses.
 *
 * The orchestrator's background scheduler (Phase 6) refreshes ranking on a
 * 24h cadence by default. The cache absorbs every redundant call between
 * refreshes so an interactive `harness models suggest` and the scheduler tick
 * share data without re-hitting the HF API.
 *
 * The on-disk layer is a single JSON file written atomically (tmp + rename)
 * so a crash mid-write cannot corrupt it (mirrors the proposal's O2 invariant
 * for the pool state file). Every read tolerates a missing or malformed file
 * by returning an empty cache — the next live request repopulates it.
 *
 * Cache schema is versioned (`CACHE_VERSION`). Loading a file with a
 * mismatched version returns an empty cache so an algorithm change that
 * affects key derivation doesn't silently return stale data.
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md (lines 89, 414–429; S4, O2)
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_VERSION = 1;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1_000;

/** Default on-disk cache location. Mirrors the spec's `~/.harness/local-models/` convention. */
export const DEFAULT_CACHE_PATH = join(
  homedir(),
  '.harness',
  'local-models',
  'cache',
  'huggingface.json'
);

/** Entry envelope. `storedAt` drives TTL; `value` is the serialized HF payload. */
export interface CacheEntry<T> {
  storedAt: number;
  value: T;
}

interface CacheFile {
  version: number;
  entries: Record<string, CacheEntry<unknown>>;
}

/** Optional clock and filesystem ports — tests inject deterministic stubs. */
export interface HuggingFaceCacheOptions {
  /** Absolute path to the cache file. Defaults to `~/.harness/local-models/cache/huggingface.json`. */
  path?: string;
  /** Per-entry TTL in milliseconds. Defaults to 24h. */
  ttlMs?: number;
  /** Clock for testability. Defaults to `Date.now`. */
  now?: () => number;
  /** Filesystem port. Defaults to `node:fs/promises` adapter. */
  fs?: CacheFilesystem;
  /** Optional structured logger; defaults to a silent no-op. */
  onWarn?: (message: string, cause?: unknown) => void;
}

/**
 * Narrow filesystem surface the cache needs. Tests substitute an in-memory
 * implementation; production uses `node:fs/promises`.
 */
export interface CacheFilesystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
}

const defaultFs: CacheFilesystem = {
  readFile: (path) => readFile(path, 'utf-8'),
  writeFile: (path, contents) => writeFile(path, contents, 'utf-8'),
  rename: (from, to) => rename(from, to),
  mkdir: (path, options) => mkdir(path, options).then(() => undefined),
};

function emptyFile(): CacheFile {
  return { version: CACHE_VERSION, entries: {} };
}

/**
 * Versioned, TTL'd cache. `get` short-circuits stale entries; `set` writes
 * memory immediately and schedules a debounced flush to disk via the public
 * `persist()` call so test code can opt into deterministic flushing.
 */
export class HuggingFaceCache {
  private readonly path: string;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly fs: CacheFilesystem;
  private readonly onWarn: (message: string, cause?: unknown) => void;
  private memory: Record<string, CacheEntry<unknown>> = {};
  private loaded = false;

  constructor(options: HuggingFaceCacheOptions = {}) {
    this.path = options.path ?? DEFAULT_CACHE_PATH;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? (() => Date.now());
    this.fs = options.fs ?? defaultFs;
    this.onWarn = options.onWarn ?? (() => undefined);
  }

  /**
   * Hydrate the in-memory map from the on-disk file. Idempotent — repeated
   * calls are no-ops. Tolerates: missing file, malformed JSON, schema-version
   * mismatch. None of those throw; all reset the cache to empty and emit a
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
        this.memory = {};
        return;
      }
      this.onWarn(`huggingface cache read failed at ${this.path}`, err);
      this.memory = {};
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.onWarn(`huggingface cache file is not valid JSON at ${this.path}`, err);
      this.memory = {};
      return;
    }
    if (!isCacheFile(parsed) || parsed.version !== CACHE_VERSION) {
      this.onWarn(`huggingface cache schema version mismatch at ${this.path}`);
      this.memory = {};
      return;
    }
    this.memory = { ...parsed.entries };
  }

  /**
   * Return the value for `key` if present and within `ttlMs`. Stale or
   * missing entries return `undefined`; the caller treats both as a miss and
   * issues a live request.
   *
   * The freshness window is **exclusive** of the TTL boundary: an entry whose
   * age equals `ttlMs` is considered stale, matching the documented OT4.
   */
  get<T>(key: string): T | undefined {
    const entry = this.memory[key];
    if (!entry) return undefined;
    const age = this.now() - entry.storedAt;
    if (age >= this.ttlMs) return undefined;
    return entry.value as T;
  }

  /** Insert or overwrite an entry in memory. Call `persist()` to flush to disk. */
  set<T>(key: string, value: T): void {
    this.memory[key] = { storedAt: this.now(), value };
  }

  /** Remove every entry. Useful for tests; orchestrator code should prefer TTL expiry. */
  clear(): void {
    this.memory = {};
  }

  /** Snapshot of the in-memory entries. Returned by value so callers can't mutate state. */
  snapshot(): Record<string, CacheEntry<unknown>> {
    return { ...this.memory };
  }

  /**
   * Atomically persist the current memory map to disk. Writes to
   * `${path}.tmp` first, then renames — `rename` is atomic on POSIX and
   * Windows when source and destination share a volume. A crash between the
   * write and the rename leaves the previous good file intact (O2).
   */
  async persist(): Promise<void> {
    const file: CacheFile = { version: CACHE_VERSION, entries: this.memory };
    const tmp = `${this.path}.tmp`;
    await this.fs.mkdir(dirname(this.path), { recursive: true });
    await this.fs.writeFile(tmp, JSON.stringify(file, null, 2));
    await this.fs.rename(tmp, this.path);
  }
}

function isCacheFile(value: unknown): value is CacheFile {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    typeof obj.entries === 'object' &&
    obj.entries !== null &&
    !Array.isArray(obj.entries)
  );
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
export const __testing = { CACHE_VERSION, emptyFile };
