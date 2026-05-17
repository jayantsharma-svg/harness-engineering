import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Hermes Phase 2 — Pre-launch OSV malware guard.
 *
 * Queries OSV.dev's REST API (https://api.osv.dev/v1/query) for advisories
 * affecting a specific package@version, classifies them by ID prefix
 * (`MAL-*` → malicious, else "other"), and caches results on disk so that
 * the `setup-mcp` / `mcp-guard` lifecycle is sub-second on warm starts.
 *
 * Per the proposal §D6, the default network-error posture is "fail-open"
 * (warn, treat as clean) so a third-party outage cannot wedge operators
 * mid-edit; `strict: true` reverses to fail-closed.
 *
 * No new runtime dependency: uses Node 20+'s `globalThis.fetch`.
 */
export interface OsvPackageRef {
  /** Currently only `'npm'` is supported (MCP/npx surface). */
  ecosystem: 'npm';
  name: string;
  /** Optional version pin; OSV will return advisories matching this version. */
  version?: string;
}

export interface OsvAdvisory {
  id: string;
  /** OSV omits `summary` for minimal records; renderers should default it. */
  summary?: string;
  published?: string;
  modified?: string;
  references?: Array<{ type: string; url: string }>;
  affected?: Array<{
    package?: { ecosystem: string; name: string };
    ranges?: Array<{ type: string; events: Array<{ introduced?: string; fixed?: string }> }>;
    versions?: string[];
  }>;
}

export interface OsvCheckResult {
  /** Advisories whose IDs begin with `MAL-` (OSV's malware namespace). */
  malicious: OsvAdvisory[];
  /** Any non-malicious advisories returned. */
  other: OsvAdvisory[];
  /** Where the result came from. */
  source: 'cache' | 'network' | 'fail-open';
}

export interface OsvClientOptions {
  /** Directory for the disk cache. Default: `.harness/cache/osv/`. */
  cacheDir?: string;
  /** Cache TTL in hours. Default: 24. */
  cacheTtlHours?: number;
  /** Inject a custom fetch (for tests). Defaults to `globalThis.fetch`. */
  fetchFn?: typeof fetch;
  /** Logger sink for warnings. Default: console.warn. */
  logger?: { warn: (m: string, ctx?: Record<string, unknown>) => void };
  /** Fail closed on network errors when true. Default: false. */
  strict?: boolean;
}

export interface OsvClient {
  check(pkg: OsvPackageRef): Promise<OsvCheckResult>;
  clearCache(): Promise<void>;
}

const OSV_ENDPOINT = 'https://api.osv.dev/v1/query';
const DEFAULT_CACHE_DIR = path.join('.harness', 'cache', 'osv');
const DEFAULT_TTL_HOURS = 24;

/**
 * Factory for the OSV client.
 */
export function createOsvClient(options: OsvClientOptions = {}): OsvClient {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  const ttlMs = (options.cacheTtlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const logger = options.logger ?? { warn: (m, ctx) => console.warn(m, ctx) };
  const strict = options.strict ?? false;

  return {
    async check(pkg: OsvPackageRef): Promise<OsvCheckResult> {
      const cacheKey = `${pkg.ecosystem}-${sanitizePkgName(pkg.name)}@${pkg.version ?? 'latest'}.json`;
      const cachePath = path.join(cacheDir, cacheKey);

      const cached = await readCache(cachePath, ttlMs);
      if (cached) {
        return { ...cached, source: 'cache' };
      }

      try {
        const advisories = await queryOsv(fetchFn, pkg);
        const result = classify(advisories);
        await writeCache(cachePath, result);
        return { ...result, source: 'network' };
      } catch (err) {
        const message = `OSV query failed for ${pkg.name}@${pkg.version ?? 'latest'}: ${String(err)}`;
        if (strict) {
          throw new Error(message, { cause: err });
        }
        logger.warn(message, { pkg });
        return { malicious: [], other: [], source: 'fail-open' };
      }
    },

    async clearCache(): Promise<void> {
      try {
        await fs.promises.rm(cacheDir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}

async function queryOsv(fetchFn: typeof fetch, pkg: OsvPackageRef): Promise<OsvAdvisory[]> {
  const body: Record<string, unknown> = {
    package: { ecosystem: pkg.ecosystem, name: pkg.name },
  };
  if (pkg.version) body.version = pkg.version;

  const response = await fetchFn(OSV_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OSV returned HTTP ${response.status}`);
  }
  const json = (await response.json()) as { vulns?: OsvAdvisory[] };
  return json.vulns ?? [];
}

function classify(advisories: OsvAdvisory[]): { malicious: OsvAdvisory[]; other: OsvAdvisory[] } {
  const malicious: OsvAdvisory[] = [];
  const other: OsvAdvisory[] = [];
  for (const a of advisories) {
    if (typeof a?.id === 'string' && a.id.startsWith('MAL-')) {
      malicious.push(a);
    } else {
      other.push(a);
    }
  }
  return { malicious, other };
}

async function readCache(
  cachePath: string,
  ttlMs: number
): Promise<{ malicious: OsvAdvisory[]; other: OsvAdvisory[] } | null> {
  try {
    const stat = await fs.promises.stat(cachePath);
    if (Date.now() - stat.mtimeMs > ttlMs) return null;
    const buf = await fs.promises.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(buf) as { malicious?: OsvAdvisory[]; other?: OsvAdvisory[] };
    return { malicious: parsed.malicious ?? [], other: parsed.other ?? [] };
  } catch {
    return null;
  }
}

async function writeCache(
  cachePath: string,
  payload: { malicious: OsvAdvisory[]; other: OsvAdvisory[] }
): Promise<void> {
  try {
    await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.promises.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch {
    // cache write failure is non-fatal
  }
}

function sanitizePkgName(name: string): string {
  // npm scoped names contain `/`; replace with `__` for filesystem safety.
  return name.replace(/[/\\]/g, '__');
}
