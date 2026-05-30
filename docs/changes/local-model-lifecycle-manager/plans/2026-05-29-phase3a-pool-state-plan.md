# Plan: LMLM Phase 3a — Pool State + Eviction Planner

**Date:** 2026-05-29 | **Spec:** `docs/changes/local-model-lifecycle-manager/proposal.md` (Phase 3, lines 431–443) | **Tasks:** 5 | **Time:** ~3 hours | **Integration Tier:** small | **Session:** `changes--local-model-lifecycle-manager--phase3a`

## Goal

Ship the two pure infrastructure modules the Phase 3b Ollama installer + pool manager will compose: a `PoolStateStore` that atomically persists `PoolState` to `~/.harness/local-models/pool.json`, and a `planEviction` function that selects the lowest-score-LRU candidates to evict for a requested disk budget. Both modules are side-effect-free at the algorithm layer (the store accepts an injectable `CacheFilesystem`-shaped seam) so the rest of Phase 3 can stack on top without re-modeling the persistence semantics.

Phase 3a does **not** ship the Ollama installer (`installer/ollama.ts`), the advisory installer (`installer/advisory.ts`), the high-level `PoolManager` orchestrator (`pool/manager.ts`), or any CLI subcommands — those land in Phase 3b. The `PoolEntry` / `PoolState` / `EvictionPlan` types already landed in the `feat/lmlm-phase3a-pool-state-87ed51b9` branch's `pool/types.ts` stub; this plan consumes them unchanged.

## Phase 3a Scope (from spec Phase 3, lines 431–443)

In:

- `src/pool/state.ts` — `PoolStateStore` with `load()`, `current()`, `mutate(fn)`, `persist()`. Atomic on-disk persistence to `~/.harness/local-models/pool.json` via tmp + rename (O2). Versioned schema so a Phase 3+ format change doesn't silently consume stale records. Tolerates missing / malformed / version-mismatched files by returning the empty pool. Recomputes derived `diskUsedGb` on every mutation so callers cannot drift entries and the total apart.
- `src/pool/eviction.ts` — `planEviction(state, { neededGb })` returning an `EvictionPlan` whose `evict[]` is ordered lowest `currentScore` first, ties broken by oldest `lastUsedAt` (treating `null` as oldest). `freedGb` and `remainingNeededGb` are derived from the selection. Pure function — no I/O.
- `src/pool/index.ts` — barrel re-exporting `PoolStateStore`, `planEviction`, and the existing `pool/types.ts` shapes.
- `src/index.ts` — re-export `./pool/index.js` alongside the existing hardware / huggingface / ranker exports.
- Tests under `tests/pool/`: `state.test.ts`, `eviction.test.ts`.
- `.changeset/lmlm-phase3a-pool-state.md` — minor bump.
- README — single-paragraph Phase 3a status note.

Out of Phase 3a (deferred to 3b):

- `installer/interface.ts`, `installer/ollama.ts`, `installer/advisory.ts` — the install adapter abstraction and Ollama REST client.
- `pool/manager.ts` — the high-level orchestrator that combines `PoolStateStore`, `planEviction`, an `InstallAdapter`, allowlist enforcement, and the `LocalModelsConfig` shape.
- CLI subcommands `harness models pool {show,set-budget,allow-org,allow-family}`, `install`, `evict`.
- Integration tests against a real Ollama instance.
- HTTP / WS / dashboard / scheduler wiring (Phases 6–8).

## Observable Truths (Acceptance Criteria — Phase 3a only)

1. **OT1**: `new PoolStateStore({ path, fs }).load()` on a missing file returns the `EmptyPoolState()` factory output. No file is created on disk and no warning is emitted (a fresh install is the normal first run).
2. **OT2**: `store.mutate((draft) => { draft.entries.push(entry) })` followed by `store.persist()` writes via `path.tmp` and renames to `path`, in that order — verified by inspecting the recorded fs op log. A crash between the write and the rename leaves the previous good file intact.
3. **OT3**: `store.current().diskUsedGb` always equals `sum(entries.sizeOnDiskGb)`. The mutator cannot set it directly; if a mutator function assigns to `draft.diskUsedGb`, the assignment is overwritten on `mutate` return. Verified by a mutator that tries to set `diskUsedGb = 999` and asserting the published current state recomputes it.
4. **OT4**: Loading a pool file whose `version` does not match the current `POOL_STATE_VERSION` returns `EmptyPoolState()` and emits a structured warning. Verified with a synthetic file at `version: 99`.
5. **OT5**: Loading a pool file that is not valid JSON returns `EmptyPoolState()` and emits a structured warning. Verified with `'{not json'` body.
6. **OT6**: `store.load()` is idempotent — repeated calls do not re-read disk. Verified by counting `readFile` calls on the recorded fs.
7. **OT7**: `planEviction({ neededGb: 0 }, populated state)` returns `{ evict: [], freedGb: 0, remainingNeededGb: 0 }` (no-op for a zero ask).
8. **OT8**: `planEviction({ neededGb: 5 })` on a pool whose lowest-score entry frees exactly 5 GB returns that single entry with `freedGb: 5`, `remainingNeededGb: 0`.
9. **OT9**: Eviction ordering is `currentScore` ascending, with ties broken by `lastUsedAt` ascending where `null` is treated as oldest (an unused fresh install should evict before a recently-used model at the same score). Verified by a fixture with two entries at identical scores, one used and one `null`.
10. **OT10**: When the entire pool cannot satisfy `neededGb`, `planEviction` returns every entry in `evict[]` (still ordered) with `remainingNeededGb` equal to the shortfall — the caller chooses whether to treat that as an error.
11. **OT11**: `pnpm --filter @harness-engineering/local-models build`, `typecheck`, `lint`, and `test` are all green; Phases 1, 2a, 2b tests pass unchanged.

## Skill Recommendations

- `tdd-classicist` (reference) — store + planner each have table-driven tests with no real I/O. The fs port is the seam.
- `ts-type-guards` (reference) — `isPoolFile` guards the load path so a malformed record can't surface as an obscure runtime crash.
- `single-writer` (reference) — `mutate(fn)` is the single mutation path; `current()` returns a frozen snapshot so consumers cannot reach back into the store and edit live state.

## File Map

- CREATE `packages/local-models/src/pool/state.ts`
- CREATE `packages/local-models/src/pool/eviction.ts`
- CREATE `packages/local-models/src/pool/index.ts`
- MODIFY `packages/local-models/src/index.ts` — re-export `./pool/index.js`
- CREATE `packages/local-models/tests/pool/state.test.ts`
- CREATE `packages/local-models/tests/pool/eviction.test.ts`
- CREATE `.changeset/lmlm-phase3a-pool-state.md`
- MODIFY `packages/local-models/README.md` — single-paragraph Phase 3a note

## Skeleton

1. Land `pool/state.ts` — versioned `CacheFilesystem`-port store, mutator that recomputes `diskUsedGb`, idempotent `load()`.
2. Land `pool/eviction.ts` — pure planner sorting by `(currentScore, lastUsedAt)` and accumulating to `neededGb`.
3. Land barrel + index re-export.
4. Tests for both modules — recorded-fs harness identical to the HF cache tests, plus pure planner table tests.
5. Verification gate (`build`, `typecheck`, `test`, `lint`, `harness validate`).
6. Changeset + README touch-up.

## Uncertainties

- **[ASSUMPTION]** The on-disk schema is versioned as `POOL_STATE_VERSION = 1`. A schema-version mismatch resets to `EmptyPoolState()` rather than attempting an upgrade — Phase 3b can add a forward migration if/when a v2 ships, but v1 has no predecessor to migrate from.
- **[ASSUMPTION]** Eviction's secondary sort key is `lastUsedAt` ascending with `null` first. This matches the proposal's "lowest-score-LRU" wording: between two equally-scored models, the one used longer ago is the better eviction target. An entry that was never resolved (`lastUsedAt = null`) ranks before a recently-used entry at the same score so unused fresh installs don't pin the budget.
- **[DEFERRABLE]** Concurrency / multi-process locking on the pool file. Phase 3a assumes the orchestrator process is the single writer (matches Phase 0's runtime assumptions). Phase 6's scheduler runs in the same process. A multi-orchestrator deployment would need an advisory lock, but that's a deployment concern outside LMLM's scope today.

## Tasks

### Task 1: Land `pool/state.ts`

**Depends on:** none | **Files:** `src/pool/state.ts`

1. Define `POOL_STATE_VERSION = 1`.
2. Define `DEFAULT_POOL_STATE_PATH = join(homedir(), '.harness', 'local-models', 'pool.json')`.
3. Reuse the `CacheFilesystem` shape conceptually (re-declare a local `PoolFilesystem` interface with the same method surface — `readFile`, `writeFile`, `rename`, `mkdir` — so the two modules stay decoupled).
4. `PoolStateStoreOptions`: `{ path?, fs?, onWarn? }` mirroring `HuggingFaceCacheOptions`.
5. `PoolStateStore`:
   - `load()` — idempotent; tolerate missing (ENOENT, no warning) / malformed JSON / version mismatch / shape mismatch (warn + reset to empty).
   - `current()` — returns a structured-clone snapshot of the in-memory state so callers can't mutate live state.
   - `mutate(fn: (draft: PoolState) => void)` — runs `fn` on a clone, recomputes `draft.diskUsedGb` from `draft.entries.sizeOnDiskGb` sum, replaces in-memory state with the recomputed draft. Returns the new snapshot.
   - `persist()` — `mkdir` parents, write JSON to `${path}.tmp`, `rename` to `path`.
6. `isPoolFile` guard — checks `version: number`, `state` shape (entries array of `{ ollamaName, hfRepoId, sizeOnDiskGb, installedAt, lastUsedAt, currentScore }`, `diskBudgetGb: number`, `allowedOrgs: string[]`, `allowedFamilies: string[]`, `lastRefreshAt: string | null`).
7. Optional `__testing` accessor exporting `POOL_STATE_VERSION` + `isPoolFile` for whitebox tests.

Acceptance: typecheck clean; OT1–OT6 covered by tests in Task 4.

### Task 2: Land `pool/eviction.ts`

**Depends on:** Task 1 | **Files:** `src/pool/eviction.ts`

1. Export `EvictionRequest = { neededGb: number }`.
2. Export `planEviction(state: PoolState, request: EvictionRequest): EvictionPlan`:
   - Short-circuit when `neededGb <= 0` ⇒ `{ evict: [], freedGb: 0, remainingNeededGb: 0 }`.
   - Sort entries ascending by `(currentScore, lastUsedAtMs)` where `null` ⇒ `-Infinity` so unused entries evict first.
   - Walk the sorted list accumulating `sizeOnDiskGb` until the total ≥ `neededGb` or the list is exhausted.
   - Return `{ evict, freedGb, remainingNeededGb: Math.max(0, neededGb - freedGb) }`.
3. Helpers internal-only: `lastUsedRank(entry)` returns `entry.lastUsedAt ? Date.parse(entry.lastUsedAt) : -Infinity`.

Acceptance: typecheck clean; OT7–OT10 covered by tests in Task 4.

### Task 3: Wire pool barrel + package barrel

**Depends on:** Tasks 1–2 | **Files:** `src/pool/index.ts`, `src/index.ts`

1. `pool/index.ts` — `export * from './types.js'; export * from './state.js'; export * from './eviction.js';`.
2. `src/index.ts` — add `export * from './pool/index.js';` after the existing exports.

### Task 4: Tests for state + eviction

**Depends on:** Tasks 1–3 | **Files:** `tests/pool/state.test.ts`, `tests/pool/eviction.test.ts`

1. `state.test.ts` (recorded-fs harness, structurally identical to `tests/huggingface/cache.test.ts`):
   - Missing file ⇒ empty state, no warning, no fs writes.
   - `mutate` + `persist` writes to `${path}.tmp` then renames to `path`; persisted JSON has `version: 1` + recomputed `diskUsedGb`.
   - Hydrates a previously persisted file: same entries surface through `current()`.
   - Malformed JSON ⇒ empty + warning containing `'not valid JSON'`.
   - Schema version mismatch (`version: 99`) ⇒ empty + warning containing `'schema version mismatch'`.
   - Shape mismatch (`entries` missing) ⇒ empty + warning containing `'pool file shape mismatch'`.
   - `current()` returns an isolated snapshot — mutating the returned value does not affect the next `current()` call.
   - `mutate` always recomputes `diskUsedGb` (a mutator that sets `draft.diskUsedGb = 999` is overwritten).
   - `load()` is idempotent — only one `readFile` op even after three calls.
2. `eviction.test.ts` (pure, no I/O):
   - `neededGb: 0` ⇒ empty plan.
   - Single lowest-score entry exactly satisfies `neededGb`.
   - Tie on score: older `lastUsedAt` evicts first; `null` lastUsedAt evicts before any timestamp at the same score.
   - Accumulation across multiple entries: list keeps growing until budget is met.
   - Pool too small ⇒ all entries in `evict[]`, `remainingNeededGb` equals the shortfall.

### Task 5: Verification gate

**Depends on:** Tasks 1–4 | **Files:** none

1. `pnpm --filter @harness-engineering/local-models typecheck` — green.
2. `pnpm --filter @harness-engineering/local-models test` — green.
3. `pnpm --filter @harness-engineering/local-models build` — green.
4. `pnpm --filter @harness-engineering/local-models lint` — green.
5. `pnpm exec harness validate` from repo root — no new issues introduced under `packages/local-models`.

## Integration Notes

Phase 3a's integration footprint stays at the package boundary, same as 2a/2b:

- The new exports (`PoolStateStore`, `DEFAULT_POOL_STATE_PATH`, `planEviction`, plus the already-shipping types) reach the public surface through `pool/index.ts` → `src/index.ts`. No orchestrator, CLI, dashboard, or HTTP wiring lands here.
- **Phase 3b (installer + manager)** is the first consumer of `PoolStateStore.mutate` + `planEviction`. The `PoolManager` orchestrator wraps both with allowlist enforcement and an `InstallAdapter`.
- **Phase 4 (resolver integration)** consumes `PoolStateStore.current()` read-only to derive the resolver's candidate list.
- **Phase 6 (scheduler)** writes to the store via the manager during drift reconciliation (D12).

**Knowledge graph**: no new concepts entered in Phase 3a. `Local Model Pool` enters the graph in Phase 9 when the operator-visible surface ships.

**ADRs**: none in Phase 3a. The pool-bounded-autonomy ADR (ADR-NNNN+3) and the silent-drift-reconciliation ADR (ADR-NNNN+5) both land with Phase 6 when the scheduler closes the loop.

**Docs**: changeset entry + a one-paragraph README note. The operator guide lands in Phase 9.
