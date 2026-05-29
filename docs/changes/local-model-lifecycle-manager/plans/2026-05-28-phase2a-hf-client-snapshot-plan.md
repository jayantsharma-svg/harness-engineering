# Plan: LMLM Phase 2a — HuggingFace client + cache + frozen snapshot

**Date:** 2026-05-28 | **Spec:** `docs/changes/local-model-lifecycle-manager/proposal.md` (Phase 2, lines 414–429) | **Tasks:** 7 | **Time:** ~3 hours | **Integration Tier:** small | **Session:** `changes--local-model-lifecycle-manager--phase2a`

## Goal

Stand up the data plane the ranker (Phase 2b–d) will consume: a typed `HuggingFaceClient` over the public HF REST endpoints (`/api/models`, `/api/models/:repo`), an in-memory + on-disk cache for those responses, and a frozen benchmark snapshot the orchestrator can fall back to when HF and the live leaderboard sources are unreachable. None of these surfaces require the VRAM/speed math or the merge algorithm — they are independently testable infrastructure that locks down the contract Phase 2b–d will build on top of.

Phase 2a does **not** ship the ranker, the evidence/recency math, the live benchmark source adapters, or any orchestrator wiring. It ships the bricks; later phases stack them.

## Phase 2a Scope (from spec Phase 2, lines 414–429)

In:

- `src/huggingface/types.ts` — `HuggingFaceModel`, `HuggingFaceModelDetail`, `HuggingFaceListOptions`, `HuggingFaceClientOptions`, `HuggingFaceFetcher`, `HuggingFaceFetchResponse`, `HuggingFaceErrorCode`
- `src/huggingface/client.ts` — typed wrapper over `/api/models` and `/api/models/:repo`; injected `fetcher` DI seam mirrors Phase 1's `ShellRunner`; every failure mode maps to a `HuggingFaceClientError` with a stable `code`
- `src/huggingface/cache.ts` — versioned in-memory map + atomic on-disk JSON file at `~/.harness/local-models/cache/huggingface.json` (tmp + rename — O2 invariant); tolerates missing / malformed / version-mismatched files by resetting to empty and emitting a structured warning
- `src/huggingface/index.ts` — public barrel
- `src/ranker/benchmarks/types.ts` — `BenchmarkEvidence`, `BenchmarkObservation`, `ModelBenchmark`, `BenchmarkSnapshot`, `BenchmarkSnapshotLoadResult`, `BenchmarkSnapshotWarning`, `emptySnapshot`
- `src/ranker/benchmarks/snapshot.ts` — `loadFrozenSnapshot()` reading `./snapshot.json`; structural validation; never throws (S4)
- `src/ranker/benchmarks/snapshot.json` — seed snapshot (≥ 3 models across distinct families) so Phase 2c has something to merge against on its first run
- `src/ranker/benchmarks/index.ts` + `src/ranker/index.ts` — barrels that re-export the snapshot loader and types
- `src/index.ts` — re-export `./huggingface/index.js` and `./ranker/index.js`
- Tests for each module under `tests/huggingface/` and `tests/ranker/benchmarks/` plus a fixture HF list response

Out of Phase 2a (deferred to 2b–d):

- VRAM math (`ranker/vram.ts`) and speed math (`ranker/speed.ts`) — Phase 2b
- Evidence grading and lineage-aware recency demotion — Phase 2c
- Live benchmark source adapters (Open LLM Leaderboard, LiveBench, …) and the cross-source merge — Phase 2c
- The `RankedModel` type and the `algorithm.ts` orchestrator that produces it — Phase 2d
- Parity tests against `m3-max-36gb.json` / `rtx-4090-24gb.json` (Q1, Q2) — Phase 2d, once the algorithm exists
- HTTP routes, CLI commands, dashboard panel — Phases 7–8
- Orchestrator wiring — Phase 6 (when the scheduler boots)

## Observable Truths (Acceptance Criteria — Phase 2a only)

1. **OT1**: `HuggingFaceClient.listModels()` issues exactly one `GET /api/models?...` call through the injected `fetcher`, parses the array response into `HuggingFaceModel[]`, and never reads from the cache itself (caching is the caller's responsibility — Phase 2c).
2. **OT2**: When the fetcher resolves with `status: 404`, the client throws a `HuggingFaceClientError` with `code: 'HF_NOT_FOUND'` and the original status / URL attached. `401`/`403` → `'HF_UNAUTHORIZED'`. `429` and `5xx` → `'HF_UNAVAILABLE'`. Network rejections → `'HF_NETWORK'`. Non-JSON bodies → `'HF_PARSE'`.
3. **OT3**: `HuggingFaceClient.getModel('Qwen/Qwen3-32B-GGUF')` URL-encodes the repo id (the `/` is preserved via `encodeURI`) so the request lands on `/api/models/Qwen/Qwen3-32B-GGUF`, not `/api/models/Qwen%2FQwen3-32B-GGUF`.
4. **OT4**: `HuggingFaceCache.get(key)` returns `undefined` for missing entries and for entries whose age (now − storedAt) is `>= ttlMs`. Within the TTL window it returns the stored value verbatim.
5. **OT5**: `HuggingFaceCache.persist()` writes a versioned envelope to `${path}.tmp` first and renames to `path` (verified by asserting `writeFile` is called with the `.tmp` suffix and `rename` is called with the matching source/destination). A second `load()` after `persist()` rehydrates the same entries.
6. **OT6**: `HuggingFaceCache.load()` on a missing file returns silently with an empty memory map; on malformed JSON it emits a structured `onWarn` and resets to empty; on a schema-version mismatch it emits a warning and resets to empty. None of those paths throw.
7. **OT7**: `loadFrozenSnapshot()` on the bundled `snapshot.json` returns `source: 'frozen'` with `warnings: []` and `snapshot.models.length >= 3`.
8. **OT8**: `loadFrozenSnapshot({ reader: async () => '{bad-json' })` returns `source: 'fallback'`, an empty snapshot, and a single `snapshot_parse_failed` warning. A reader that throws yields `snapshot_read_failed`; a syntactically valid but structurally invalid payload yields `snapshot_schema_invalid`. The function never throws.
9. **OT9**: `pnpm --filter @harness-engineering/local-models build`, `typecheck`, and `test` are all green.
10. **OT10**: Existing Phase 1 hardware tests pass unchanged; the new tests live alongside them without new flakes.

## Skill Recommendations

- `gof-strategy` (reference) — the injected `fetcher` and `CacheFilesystem` are interchangeable strategies; tests substitute deterministic implementations without monkey-patching globals.
- `tdd-classicist` (reference) — each unit's tests are pure and dependency-injected; no live network, no real `~/.harness` writes.

## File Map

- CREATE `packages/local-models/src/huggingface/types.ts`
- EXISTS `packages/local-models/src/huggingface/client.ts` (regenerated last session; needs `types.ts` + `exactOptionalPropertyTypes` fix)
- EXISTS `packages/local-models/src/huggingface/cache.ts`
- EXISTS `packages/local-models/src/huggingface/index.ts`
- EXISTS `packages/local-models/src/ranker/benchmarks/types.ts`
- EXISTS `packages/local-models/src/ranker/benchmarks/snapshot.ts` (needs an `exactOptionalPropertyTypes` fix in `validateModel`)
- EXISTS `packages/local-models/src/ranker/benchmarks/snapshot.json`
- EXISTS `packages/local-models/src/ranker/benchmarks/index.ts`
- EXISTS `packages/local-models/src/ranker/index.ts`
- MODIFY `packages/local-models/src/index.ts` (already updated to export the new barrels)
- CREATE `packages/local-models/tests/huggingface/client.test.ts`
- CREATE `packages/local-models/tests/huggingface/cache.test.ts`
- CREATE `packages/local-models/tests/ranker/benchmarks/snapshot.test.ts`
- CREATE `packages/local-models/tests/fixtures/hf-list-qwen-trending.json`
- CREATE `.changeset/lmlm-phase2a-hf-client-snapshot.md`
- MODIFY `packages/local-models/README.md` — single-paragraph Phase 2a note

## Skeleton

1. Land the missing `huggingface/types.ts` and close the `exactOptionalPropertyTypes` gaps in `client.ts` / `snapshot.ts` so `pnpm typecheck` is green again. (~1 task)
2. Test the HF client end-to-end through an injected fetcher: success, every error code, URL encoding, timeout/abort. (~1 task)
3. Test the cache end-to-end through an injected filesystem: load/persist round-trip, TTL boundary, malformed file, version mismatch. (~1 task)
4. Test the snapshot loader: bundled JSON happy path + every fallback branch through injected readers. (~1 task)
5. Verification gate. (~1 task)
6. Changeset + README touch-up. (~1 task)

**Estimated total:** 7 tasks, ~3 hours.

## Uncertainties

- **[ASSUMPTION]** `fetch` is globally available — Node ≥ 18 guarantees it (matches the monorepo baseline already stated in the spec's Assumptions section). No `node-fetch` / `undici` dependency added.
- **[ASSUMPTION]** The HF `/api/models` and `/api/models/:repo` shapes are backward-compatible. The client extracts only `id`, `downloads`, `likes`, `lastModified`, `tags`, `license`, `author`, and `siblings[].rfilename` — fields the spec calls out (lines 88–91). Other fields are ignored, so additive HF changes don't break us.
- **[ASSUMPTION]** The seed snapshot ships three models (Qwen3-32B, DeepSeek-R1-Distill-Qwen-32B, Llama-3.3-70B) with single observations each. Phase 2c will replace this with a curated set sourced from the real leaderboards; the count and contents are intentionally minimal so the seed isn't read as a recommendation.
- **[DEFERRABLE]** Pagination — the HF list endpoint caps at 100 per request and we only need the top trending slice in Phase 2c. Pagination lands when (and if) Phase 2c's source adapters need it.
- **[DEFERRABLE]** ETag / `If-None-Match` round-trips — the cache TTL is the sole freshness mechanism in 2a. Conditional GETs land in 2c once the scheduler can act on `304` responses.

## Tasks

### Task 1: Land `huggingface/types.ts` + close `exactOptionalPropertyTypes` gaps

**Depends on:** none | **Files:** `src/huggingface/types.ts`, `src/huggingface/client.ts`, `src/ranker/benchmarks/snapshot.ts`

1. Author `types.ts` with the shapes the client and barrel reference:
   - `HuggingFaceModel` — `{ id; downloads; likes; lastModified?; tags; license?; author? }`
   - `HuggingFaceModelDetail extends HuggingFaceModel` — adds `siblings: { rfilename: string }[]`
   - `HuggingFaceListOptions` — `{ search?; author?; filter?; sort?; limit?; signal? }`
   - `HuggingFaceClientOptions` — `{ baseUrl?; token?; fetcher?; timeoutMs? }`
   - `HuggingFaceFetcher` — `(url: string, init: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<HuggingFaceFetchResponse>`
   - `HuggingFaceFetchResponse` — `{ status; json(); text() }`
   - `HuggingFaceErrorCode` — `'HF_NOT_FOUND' | 'HF_UNAUTHORIZED' | 'HF_UNAVAILABLE' | 'HF_NETWORK' | 'HF_PARSE'`
2. `client.ts`: change the `HuggingFaceClientError` constructor to only assign `status`/`url` when defined (use spread or explicit `if`); use spread in the throw sites so undefined optionals never leak into the property bag. Keep the public class shape unchanged.
3. `snapshot.ts` (`validateModel`): only set `ollamaName` / `activeB` keys when present. Pattern: build the object via spread (`...(typeof value.ollamaName === 'string' ? { ollamaName: value.ollamaName } : {})`).

Acceptance: `pnpm --filter @harness-engineering/local-models typecheck` clean.

### Task 2: HF client tests

**Depends on:** Task 1 | **Files:** `tests/huggingface/client.test.ts`, `tests/fixtures/hf-list-qwen-trending.json`

1. Fixture: a 2-entry trimmed `/api/models?author=Qwen&sort=trending` response covering `id`, `downloads`, `likes`, `lastModified`, `tags`, `license`.
2. Tests:
   - Happy path `listModels({ author: 'Qwen', sort: 'trending', limit: 100 })` — asserts the URL the fetcher sees and the parsed array.
   - `getModel('Qwen/Qwen3-32B-GGUF')` — asserts the path preserves the slash.
   - Error mapping: `404 → HF_NOT_FOUND`, `401 → HF_UNAUTHORIZED`, `429 → HF_UNAVAILABLE`, `503 → HF_UNAVAILABLE`, network rejection → `HF_NETWORK`, malformed body → `HF_PARSE`.
   - Timeout: pass a `timeoutMs: 1` and a fetcher that never resolves; assert the error is `HF_NETWORK` with `cause.name === 'AbortError'`.
   - Authorization: pass `token: 'abc'` and assert the fetcher receives `Authorization: Bearer abc`. Without a token and `HF_TOKEN` unset, no Authorization header is set.

### Task 3: Cache tests

**Depends on:** Task 1 | **Files:** `tests/huggingface/cache.test.ts`

1. In-memory `CacheFilesystem` stub backed by a `Map<string, string>` with controllable `ENOENT` injection.
2. Tests:
   - `set` then `get` returns the value within TTL.
   - `get` returns undefined when `now - storedAt >= ttlMs` (boundary check).
   - `persist()` writes to `${path}.tmp` then `rename`s; the second `HuggingFaceCache` against the same fs rehydrates the entries.
   - `load()` on missing file leaves memory empty without warnings.
   - `load()` on malformed JSON triggers exactly one `onWarn` and resets memory.
   - `load()` on a schema-version-mismatched payload triggers exactly one `onWarn` and resets memory.

### Task 4: Snapshot loader tests

**Depends on:** Task 1 | **Files:** `tests/ranker/benchmarks/snapshot.test.ts`

1. Happy path against the bundled `snapshot.json` (no `reader` passed): `source: 'frozen'`, `warnings: []`, `models.length >= 3`.
2. Reader-throws branch: returns `'snapshot_read_failed'`.
3. Reader returns invalid JSON: returns `'snapshot_parse_failed'`.
4. Reader returns valid JSON with a wrong `version`: returns `'snapshot_schema_invalid'`.
5. Reader returns valid JSON missing the `models` array: returns `'snapshot_schema_invalid'`.
6. Reader returns valid JSON with an observation missing `evidence`: returns `'snapshot_schema_invalid'`.

### Task 5: Verification gate

**Depends on:** Tasks 1–4 | **Files:** none

1. `pnpm --filter @harness-engineering/types build` (consumers need the d.ts).
2. `pnpm --filter @harness-engineering/local-models typecheck` — green.
3. `pnpm --filter @harness-engineering/local-models test` — green; all Phase 1 tests + the new Phase 2a tests pass.
4. `pnpm --filter @harness-engineering/local-models build` — green.
5. `pnpm exec harness validate` from repo root — green (legacy config still parses).

### Task 6: Changeset

**Depends on:** Tasks 1–5 | **Files:** `.changeset/lmlm-phase2a-hf-client-snapshot.md`

1. `minor` bump on `@harness-engineering/local-models`.
2. Body summarises the three new bricks (HF client, cache, frozen snapshot) and explicitly notes the ranker math + algorithm orchestrator land in 2b–d.

### Task 7: README + plan integration

**Depends on:** Tasks 1–6 | **Files:** `packages/local-models/README.md`

1. Append a short Phase 2a section describing the new public exports and the still-pending phases. Keep the file under a page.

## Integration Notes

Phase 2a's integration footprint stays at the package boundary:

- The new exports (`HuggingFaceClient`, `HuggingFaceCache`, `loadFrozenSnapshot`, the shared types) are surfaced through the package barrel only. No orchestrator, CLI, dashboard, or HTTP wiring lands here.
- **Phase 2b (VRAM/Speed)** is pure math and doesn't consume the HF client.
- **Phase 2c (Evidence + Recency + Merge)** consumes `HuggingFaceClient` (popularity weighting) and `loadFrozenSnapshot` (offline fallback).
- **Phase 2d (Algorithm)** consumes all of the above plus Phase 1's `HardwareDetector` to produce `RankedModel[]`.
- **Phase 6 (Scheduler)** owns the cache's lifecycle (when to `persist()`).
- **Phase 7 (HTTP)** does not expose the HF client or cache directly; it exposes only the ranker output.

**Knowledge graph**: no new concepts entered in Phase 2a. `Model Benchmark` becomes a first-class concept in Phase 2c when the merge algorithm lands.

**ADRs**: none in Phase 2a. ADR-NNNN+1 (TS port of ranking algorithm, not whichllm wrapper) lands with Phase 2d when the algorithm itself ships.

**Docs**: changeset entry + a short README note. The full `local-model-lifecycle.md` knowledge entry and operator guide land in Phase 9.
