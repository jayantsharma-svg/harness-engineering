/**
 * `HuggingFaceClient` — typed wrapper over the public HF REST endpoints LMLM
 * needs (`/api/models`, `/api/models/:repo`). The client never throws raw
 * `fetch` errors: every failure maps to a `HuggingFaceClientError` with a
 * stable `code` so the cache (Phase 2a), the snapshot fallback (Phase 2a),
 * and the eventual ranker (Phase 2c–d) can branch deterministically.
 *
 * The `fetcher` constructor option is the DI seam: tests inject a stub and
 * never make real network calls. The default `fetcher` wraps the global
 * `fetch` so production code is one line. This mirrors the `ShellRunner`
 * pattern from Phase 1's hardware detection (Plan, OT1).
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md (lines 88–91, 414–429)
 */

import type {
  HuggingFaceClientOptions,
  HuggingFaceErrorCode,
  HuggingFaceFetcher,
  HuggingFaceFetchResponse,
  HuggingFaceListOptions,
  HuggingFaceModel,
  HuggingFaceModelDetail,
} from './types.js';

const DEFAULT_BASE_URL = 'https://huggingface.co';
const DEFAULT_TIMEOUT_MS = 8_000;
const USER_AGENT = '@harness-engineering/local-models';

/**
 * Structured error type the client throws. `code` is the contract higher
 * layers branch on; `status` and `url` are diagnostics; the `cause` is the
 * underlying fetcher rejection when relevant.
 */
export class HuggingFaceClientError extends Error {
  readonly code: HuggingFaceErrorCode;
  readonly status?: number;
  readonly url?: string;

  constructor(
    code: HuggingFaceErrorCode,
    message: string,
    options?: { status?: number; url?: string; cause?: unknown }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'HuggingFaceClientError';
    this.code = code;
    if (options?.status !== undefined) this.status = options.status;
    if (options?.url !== undefined) this.url = options.url;
  }
}

/**
 * Default fetcher backed by the global `fetch`. Adapts the Web `Response`
 * down to the narrow `HuggingFaceFetchResponse` surface so the client doesn't
 * carry the full DOM lib's type baggage into tests.
 */
function defaultFetcher(): HuggingFaceFetcher {
  return async (url, init) => {
    const response = await fetch(url, init);
    return {
      status: response.status,
      json: () => response.json() as Promise<unknown>,
      text: () => response.text(),
    } satisfies HuggingFaceFetchResponse;
  };
}

/**
 * Read a token from the constructor option first, falling back to the
 * `HF_TOKEN` env var. Empty strings are treated as unset so callers can pass
 * `process.env.HF_TOKEN` without guarding against `''`.
 */
function resolveToken(option: string | undefined): string | undefined {
  if (option && option.length > 0) return option;
  const env = process.env.HF_TOKEN;
  if (env && env.length > 0) return env;
  return undefined;
}

function buildHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Map an HTTP status to a stable `HuggingFaceErrorCode`. The client surfaces
 * the original status and body excerpt in the error message so operators can
 * diagnose specifics without reading the code.
 */
function statusToCode(status: number): HuggingFaceErrorCode {
  if (status === 404) return 'HF_NOT_FOUND';
  if (status === 401 || status === 403) return 'HF_UNAUTHORIZED';
  if (status === 429 || (status >= 500 && status <= 599)) return 'HF_UNAVAILABLE';
  return 'HF_UNAVAILABLE';
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'AbortError'
  );
}

/**
 * Serialize query params in a stable order so cache keys are deterministic.
 * Skips undefined / empty values to keep URLs tidy.
 */
function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b)) as Array<[string, string | number]>;
  if (entries.length === 0) return '';
  const search = new URLSearchParams();
  for (const [key, value] of entries) search.set(key, String(value));
  return `?${search.toString()}`;
}

/** Narrow a `unknown` HF item into the `HuggingFaceModel` shape. */
function parseModel(value: unknown, url: string): HuggingFaceModel {
  if (typeof value !== 'object' || value === null) {
    throw new HuggingFaceClientError('HF_PARSE', 'HuggingFace returned a non-object model entry', {
      url,
    });
  }
  const raw = value as Record<string, unknown>;
  const id = raw.id ?? raw.modelId;
  if (typeof id !== 'string' || id.length === 0) {
    throw new HuggingFaceClientError('HF_PARSE', 'HuggingFace model entry missing id', { url });
  }
  const tags = Array.isArray(raw.tags)
    ? (raw.tags.filter((t): t is string => typeof t === 'string') as readonly string[])
    : [];
  const author =
    typeof raw.author === 'string' && raw.author.length > 0 ? raw.author : extractAuthor(id);
  return {
    id,
    downloads: typeof raw.downloads === 'number' ? raw.downloads : 0,
    likes: typeof raw.likes === 'number' ? raw.likes : 0,
    tags,
    ...(typeof raw.lastModified === 'string' ? { lastModified: raw.lastModified } : {}),
    ...(typeof raw.license === 'string' ? { license: raw.license } : {}),
    ...(author !== undefined ? { author } : {}),
  };
}

/** "Qwen/Qwen3-32B-GGUF" → "Qwen". Returns `undefined` for un-namespaced ids. */
function extractAuthor(id: string): string | undefined {
  const slash = id.indexOf('/');
  return slash > 0 ? id.slice(0, slash) : undefined;
}

function parseModelDetail(value: unknown, url: string): HuggingFaceModelDetail {
  const base = parseModel(value, url);
  const raw = value as Record<string, unknown>;
  const siblings = Array.isArray(raw.siblings)
    ? raw.siblings
        .filter((s): s is { rfilename: string } => {
          return (
            typeof s === 'object' &&
            s !== null &&
            'rfilename' in s &&
            typeof (s as { rfilename: unknown }).rfilename === 'string'
          );
        })
        .map((s) => ({ rfilename: s.rfilename }))
    : [];
  return { ...base, siblings };
}

/**
 * Typed wrapper around HuggingFace's read endpoints. Production callers pass
 * no fetcher and the client uses `fetch`; tests pass a stub.
 */
export class HuggingFaceClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly fetcher: HuggingFaceFetcher;
  private readonly timeoutMs: number;

  constructor(options: HuggingFaceClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.token = resolveToken(options.token);
    this.fetcher = options.fetcher ?? defaultFetcher();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * List models matching the supplied filter. Single HF request, no
   * pagination in Phase 2a — the ranker's first cut consumes the top-100
   * trending result and the cache TTL absorbs subsequent calls.
   */
  async listModels(options: HuggingFaceListOptions = {}): Promise<HuggingFaceModel[]> {
    const qs = buildQueryString({
      search: options.search,
      author: options.author,
      filter: options.filter,
      sort: options.sort,
      limit: options.limit,
    });
    const url = `${this.baseUrl}/api/models${qs}`;
    const body = await this.requestJson(url, options.signal);
    if (!Array.isArray(body)) {
      throw new HuggingFaceClientError('HF_PARSE', 'HuggingFace list endpoint returned non-array', {
        url,
      });
    }
    return body.map((entry) => parseModel(entry, url));
  }

  /**
   * Fetch a single model's metadata (including the file manifest). Used by
   * the ranker to enumerate available GGUF quants without a second HEAD.
   */
  async getModel(repoId: string, signal?: AbortSignal): Promise<HuggingFaceModelDetail> {
    const url = `${this.baseUrl}/api/models/${encodeURI(repoId)}`;
    const body = await this.requestJson(url, signal);
    return parseModelDetail(body, url);
  }

  /**
   * Compact accessor used by popularity-weighted ranking. Wraps `getModel`
   * but discards everything except the download count so the caller doesn't
   * carry a full detail payload through the merge pipeline.
   */
  async getDownloadCount(repoId: string, signal?: AbortSignal): Promise<number> {
    const detail = await this.getModel(repoId, signal);
    return detail.downloads;
  }

  /**
   * Shared request path: applies headers, enforces a timeout via
   * `AbortController` (combined with the caller's optional signal), and maps
   * every failure mode to a `HuggingFaceClientError`. No raw fetcher error or
   * unhandled status escapes.
   */
  private async requestJson(url: string, externalSignal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    let response: HuggingFaceFetchResponse;
    try {
      response = await this.fetcher(url, {
        signal: controller.signal,
        headers: buildHeaders(this.token),
      });
    } catch (err) {
      if (isAbortError(err)) {
        throw new HuggingFaceClientError('HF_NETWORK', 'HuggingFace request aborted', {
          url,
          cause: err,
        });
      }
      throw new HuggingFaceClientError('HF_NETWORK', 'HuggingFace request failed', {
        url,
        cause: err,
      });
    } finally {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    }

    if (response.status < 200 || response.status >= 300) {
      const code = statusToCode(response.status);
      let detail = '';
      try {
        detail = (await response.text()).slice(0, 200);
      } catch {
        // The body read itself failed; surface only the status.
      }
      throw new HuggingFaceClientError(
        code,
        `HuggingFace request returned ${response.status}${detail ? `: ${detail}` : ''}`,
        { status: response.status, url }
      );
    }

    try {
      return await response.json();
    } catch (err) {
      throw new HuggingFaceClientError('HF_PARSE', 'HuggingFace response was not JSON', {
        url,
        cause: err,
      });
    }
  }
}
