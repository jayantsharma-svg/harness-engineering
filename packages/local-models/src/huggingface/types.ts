/**
 * HuggingFace integration — public types.
 *
 * The client is intentionally narrow: it surfaces only the fields the ranker
 * (Phases 2b–d) needs from `/api/models` and `/api/models/:repo`. Additive
 * HF changes therefore don't ripple into our type surface; subtractive
 * changes get caught here because the parser asserts shape.
 *
 * The `HuggingFaceFetcher` seam mirrors Phase 1's `ShellRunner` — every
 * outbound HTTP call goes through it, so tests can substitute a deterministic
 * stub and never hit the network.
 *
 * @see docs/changes/local-model-lifecycle-manager/proposal.md (lines 88–91, 414–429)
 */

/**
 * Stable error codes the client throws via `HuggingFaceClientError`. Callers
 * (cache, snapshot fallback, ranker) branch on `code`; the human-readable
 * `message` is for logs and operator-facing UI, not control flow.
 */
export type HuggingFaceErrorCode =
  | 'HF_NOT_FOUND'
  | 'HF_UNAUTHORIZED'
  | 'HF_UNAVAILABLE'
  | 'HF_NETWORK'
  | 'HF_PARSE';

/** Narrow response surface the client adapts `fetch` down to. */
export interface HuggingFaceFetchResponse {
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * Outbound HTTP transport. Production wraps `fetch`; tests inject a stub. The
 * shape is deliberately Web-ish (`signal`, `headers`) so the default
 * implementation is a one-liner.
 */
export type HuggingFaceFetcher = (
  url: string,
  init: { signal?: AbortSignal; headers?: Record<string, string> }
) => Promise<HuggingFaceFetchResponse>;

/** Constructor options for `HuggingFaceClient`. All fields optional. */
export interface HuggingFaceClientOptions {
  /** Base URL — defaults to `https://huggingface.co`. Strip trailing slashes. */
  baseUrl?: string;
  /** API token — defaults to `process.env.HF_TOKEN`. Empty strings are treated as unset. */
  token?: string;
  /** DI seam for tests. Defaults to a `fetch`-backed implementation. */
  fetcher?: HuggingFaceFetcher;
  /** Per-request timeout in milliseconds. Defaults to 8 seconds. */
  timeoutMs?: number;
}

/**
 * Query parameters accepted by `listModels`. Mirrors the HF API's standard
 * search/filter parameters; `sort` accepts the values HF documents
 * (`'downloads'`, `'trending'`, `'lastModified'`, …) without our client
 * passing judgement on which are valid this week.
 */
export interface HuggingFaceListOptions {
  search?: string;
  author?: string;
  filter?: string;
  sort?: string;
  limit?: number;
  /** Caller-supplied cancellation signal. Combines with the per-request timeout. */
  signal?: AbortSignal;
}

/**
 * Trimmed HF model record. Only the fields the ranker reads are typed; HF's
 * response carries more, which is parsed-and-dropped on the way in.
 */
export interface HuggingFaceModel {
  /** Stable HF repo id (`'Qwen/Qwen3-32B-GGUF'`). */
  id: string;
  /** Cumulative downloads across all revisions. */
  downloads: number;
  /** Likes — used by the popularity weighting in Phase 2c. */
  likes: number;
  /** ISO timestamp of the last modification, when reported. */
  lastModified?: string;
  /** Free-form tags (`'gguf'`, `'4-bit'`, `'mlx'`, …). */
  tags: readonly string[];
  /** SPDX-ish license slug when present. */
  license?: string;
  /** Author / org — derived from the id prefix when HF doesn't echo it explicitly. */
  author?: string;
}

/**
 * Detail variant returned by `/api/models/:repo`. Adds the file manifest the
 * ranker uses to enumerate available GGUF quants (`siblings[].rfilename`).
 */
export interface HuggingFaceModelDetail extends HuggingFaceModel {
  siblings: ReadonlyArray<{ rfilename: string }>;
}
