# Plan: LMLM Phase 0 — Package Scaffolding

**Date:** 2026-05-27 | **Spec:** `docs/changes/local-model-lifecycle-manager/proposal.md` (Phase 0 only) | **Tasks:** 7 | **Time:** ~45 min | **Integration Tier:** small | **Session:** `changes--local-model-lifecycle-manager--phase0`

## Goal

Stand up the empty `@harness-engineering/local-models` package wired into the monorepo with no business logic. Add the `LocalModelsConfig` type stub in `@harness-engineering/types` and the corresponding optional config block to the CLI schema so a config file may declare the block without failing validation. After this phase: `pnpm build && pnpm test && pnpm typecheck` green; `harness validate` passes on a config with `localModels` absent (N4) and a config with the block present.

## Phase 0 Scope (from spec, Phase 0 paragraph, lines 390–401)

In:

- Create `packages/local-models/` with `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.mts`, empty `src/index.ts`, smoke test
- Register in monorepo via `tsconfig.json` references (workspace glob `packages/*` already picks up the dir)
- Wire workspace dependency into `packages/cli` and `packages/orchestrator` (devDep only — no imports yet)
- Add `LocalModelsConfig` type stub in `packages/types/src/local-models.ts` + barrel re-export
- Extend CLI `HarnessConfigSchema` with optional `localModels: LocalModelsConfigSchema.optional()` field

Out of Phase 0 (deferred to later phases):

- Any hardware-detection, ranker, installer, pool, proposal, scheduler logic
- Any orchestrator wiring beyond a workspace dep declaration
- Any HTTP routes, WS topics, dashboard panel, CLI commands
- Any proposal-schema refactor (D11 lands in Phase 5a)

## Observable Truths (Acceptance Criteria — Phase 0 only)

1. **OT1**: `pnpm install` from repo root succeeds; `@harness-engineering/local-models` resolves as a workspace package.
2. **OT2**: `pnpm --filter @harness-engineering/local-models build` produces `packages/local-models/dist/index.{js,mjs,d.ts}`.
3. **OT3**: `pnpm --filter @harness-engineering/local-models test` runs the smoke test and reports it green.
4. **OT4**: `pnpm --filter @harness-engineering/local-models typecheck` returns 0.
5. **OT5**: `pnpm --filter @harness-engineering/types build && pnpm --filter @harness-engineering/cli typecheck` are green after `LocalModelsConfig` is added.
6. **OT6**: A config with no `localModels` block parses successfully (N4 from success criteria).
7. **OT7**: A config with `localModels: { enabled: false }` parses successfully and `enabled` defaults to `false` when absent.
8. **OT8**: `harness validate` (run from repo root) passes against the project's own `harness.config.json` (which has no `localModels` block).
9. **OT9 (architecture)**: New package is added to `tsconfig.json` references and conforms to the existing layer model. Because v1 has no cross-package imports yet, no entry in `harness.config.json` `layers` is required in Phase 0; this lands in Phase 1+ when the orchestrator begins importing the package.

## Skill Recommendations

From `docs/changes/local-model-lifecycle-manager/SKILLS.md`:

- `ts-zod-integration` (apply) — used to define `LocalModelsConfigSchema` with sensible defaults

## File Map

- CREATE `packages/local-models/package.json`
- CREATE `packages/local-models/tsconfig.json`
- CREATE `packages/local-models/tsconfig.build.json`
- CREATE `packages/local-models/vitest.config.mts`
- CREATE `packages/local-models/src/index.ts` (empty barrel + a single exported VERSION string so the smoke test has something concrete to assert)
- CREATE `packages/local-models/tests/smoke.test.ts`
- CREATE `packages/local-models/README.md` (one-paragraph stub pointing at the spec)
- MODIFY `tsconfig.json` (root) — add `{ "path": "./packages/local-models" }` to `references`
- MODIFY `packages/cli/package.json` — add `@harness-engineering/local-models` to `devDependencies` (workspace:\*)
- MODIFY `packages/orchestrator/package.json` — add `@harness-engineering/local-models` to `devDependencies` (workspace:\*)
- CREATE `packages/types/src/local-models.ts` — `LocalModelsConfig` interface + helper types
- MODIFY `packages/types/src/index.ts` — re-export from `./local-models.js`
- MODIFY `packages/cli/src/config/schema.ts` — add `LocalModelsConfigSchema` (zod) + add `localModels` field on `HarnessConfigSchema`
- CREATE `.changeset/lmlm-phase0-scaffolding.md`

## Skeleton

1. Package scaffold files (~3 tasks)
2. Workspace registration (~1 task)
3. Types stub + CLI schema (~2 tasks)
4. Changeset + verification gate (~1 task)

**Estimated total:** 7 tasks, ~45 min.

## Uncertainties

- **[ASSUMPTION]** Workspace `pnpm-workspace.yaml` glob `packages/*` automatically picks up the new package; no edit to that file required.
- **[ASSUMPTION]** The `harness.config.json` JSON schema referenced in the spec lives in the CLI's Zod schema (`packages/cli/src/config/schema.ts`), not in a separate JSON-Schema file. Confirmed by reading the file.
- **[DEFERRABLE]** Whether the dashboard package also gets a `devDependencies` workspace declaration is deferred to Phase 8 (dashboard) — Phase 0 only wires cli + orchestrator.
- **[DEFERRABLE]** Whether to add a layer entry for `local-models` to `harness.config.json` is deferred until Phase 1 (hardware detection) introduces actual code that other packages will import.

## Tasks

### Task 1: Create the package scaffold (package.json, tsconfigs, vitest config)

**Depends on:** none | **Files:** `packages/local-models/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.mts}`

1. Mirror `packages/types/package.json` (tsup build, vitest test, lint, typecheck, clean scripts) with name `@harness-engineering/local-models`, version `0.1.0`, deps: `zod ^3.25.76`, devDeps: `tsup`, `vitest`, `@vitest/coverage-v8`.
2. Mirror `packages/types/tsconfig.json` (composite) and `packages/types/tsconfig.build.json` (incremental off).
3. Mirror `packages/types/vitest.config.mts`.

### Task 2: Create empty barrel + smoke test

**Depends on:** Task 1 | **Files:** `packages/local-models/src/index.ts`, `packages/local-models/tests/smoke.test.ts`, `packages/local-models/README.md`

1. `src/index.ts` exports `export const LOCAL_MODELS_PACKAGE = '@harness-engineering/local-models' as const;` plus an `export const LOCAL_MODELS_VERSION = '0.1.0' as const;`. No business logic.
2. `tests/smoke.test.ts` imports the constants and asserts their values.
3. `README.md` is one paragraph: "Hardware-aware local-model recommender + pool manager. See `docs/changes/local-model-lifecycle-manager/proposal.md`. Phase 0 — scaffolding only; no business logic yet."

### Task 3: Register in root tsconfig + workspace dep declarations

**Depends on:** Task 1 | **Files:** `tsconfig.json` (root), `packages/cli/package.json`, `packages/orchestrator/package.json`

1. Add `{ "path": "./packages/local-models" }` to the `references` array in root `tsconfig.json`.
2. In `packages/cli/package.json`, add `"@harness-engineering/local-models": "workspace:*"` to `devDependencies` (keep sorted).
3. In `packages/orchestrator/package.json`, same as above.

### Task 4: Add `LocalModelsConfig` type stub to `@harness-engineering/types`

**Depends on:** none | **Files:** `packages/types/src/local-models.ts`, `packages/types/src/index.ts`

1. Create `packages/types/src/local-models.ts` with the `LocalModelsConfig` shape from the spec's Config schema (lines 178–198): `enabled`, `pool: { diskBudgetGb, allowedOrgs, allowedFamilies }`, `refresh: { intervalMs, proposalThreshold, jitterMs }`, `installer: { backend, ollamaEndpoint }`, `hardware: { override? }`. All fields optional except none — the entire block is optional. Add JSDoc on each field referencing the spec decision (D1, D9, D14).
2. Re-export from `packages/types/src/index.ts` via `export * from './local-models.js';`.

### Task 5: Add `LocalModelsConfigSchema` to CLI schema and wire onto `HarnessConfigSchema`

**Depends on:** Task 4 | **Files:** `packages/cli/src/config/schema.ts`

1. Add a `LocalModelsConfigSchema` (zod) mirroring the type from Task 4, with sensible defaults (`enabled: false`, `pool.diskBudgetGb: 100`, `refresh.intervalMs: 86_400_000`, `refresh.proposalThreshold: 5`, `refresh.jitterMs: 600_000`, `installer.backend: 'ollama'`, `installer.ollamaEndpoint: 'http://localhost:11434'`).
2. `refresh.intervalMs` floor: `.min(3_600_000, 'minimum 1h')` per D9.
3. `pool.allowedOrgs: z.array(z.string()).default([])`, `pool.allowedFamilies: z.array(z.string()).default([])`.
4. `installer.backend: z.enum(['ollama', 'advisory']).default('ollama')`.
5. Add `localModels: LocalModelsConfigSchema.optional()` as a new field on `HarnessConfigSchema` (after `osvGuard`).

### Task 6: Add changeset entry

**Depends on:** Tasks 1–5 | **Files:** `.changeset/lmlm-phase0-scaffolding.md`

1. Standard changeset with `patch` bumps for `@harness-engineering/local-models` (new), `@harness-engineering/types` (new export), `@harness-engineering/cli` (new schema field).
2. Body: "Scaffolds the Local Model Lifecycle Manager package (Phase 0). No runtime behavior; foundation for hardware detection, ranking, pool management, and proposal lifecycle in subsequent phases."

### Task 7: Verification gate — install, build, typecheck, test, validate

**Depends on:** Tasks 1–6 | **Files:** none

1. `pnpm install` at repo root.
2. `pnpm --filter @harness-engineering/local-models build && pnpm --filter @harness-engineering/local-models test && pnpm --filter @harness-engineering/local-models typecheck` — all green (OT2–OT4).
3. `pnpm --filter @harness-engineering/types build` — green (OT5 prerequisite).
4. `pnpm --filter @harness-engineering/cli typecheck` — green (OT5).
5. `pnpm exec harness validate` from repo root — green (OT8).
6. If any step fails: stop, diagnose, fix, re-run.

## Integration Notes

This phase's integration footprint is intentionally minimal:

- **Registration**: workspace package + tsconfig references + cli/orchestrator devDep declarations
- **Knowledge graph**: no new concepts entered in Phase 0; the spec's listed concepts (Local Model Pool, Model Proposal, etc.) land when their implementations land
- **ADRs**: none in Phase 0; the spec's seven ADRs land alongside the code that justifies them (Phases 3, 5, 6 primarily)
- **Docs**: none in Phase 0 beyond the package README stub; the `local-model-lifecycle.md` knowledge entry and operator guide land in Phase 9
