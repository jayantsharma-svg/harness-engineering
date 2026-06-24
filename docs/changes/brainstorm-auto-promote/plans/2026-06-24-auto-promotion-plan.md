# Plan: Auto-promotion of brainstormed roadmap items

**Date:** 2026-06-24 | **Spec:** docs/changes/brainstorm-auto-promote/proposal.md | **Tasks:** 9 | **Time:** ~40 min | **Integration Tier:** large

## Goal

Add a `manage_roadmap action: 'promote'` that atomically transitions an existing backlog roadmap row to `planned` (linking the spec) per a state-conditional rule set, exposed from `@harness-engineering/core`, wired into both file-mode and file-less MCP paths, and consumed by `harness-brainstorming` Phase 4 so promotion ships in the same commit as the spec.

## Observable Truths (Acceptance Criteria)

1. `promoteFeature(roadmap, {feature, spec})` against a `backlog` row returns `{ok: true, transitioned: 'backlog→planned'}` and the returned roadmap has that row at `status: 'planned'` with `spec` set. (Spec #1)
2. Against a non-existent feature, returns `{ok: true, transitioned: 'created'}`-equivalent at the MCP layer (core returns `not-found` with `closestMatches`; create is handled by caller per D2 "not found" row). (Spec #2)
3. Against `planned`/`blocked`/`needs-human` rows, returns `{ok: true, transitioned: 'spec-updated'}`, status preserved, spec updated. (Spec #3)
4. Against a row already `planned` with identical spec path, returns `{ok: true, transitioned: 'noop'}` and the roadmap is byte-identical after serialize. (Spec #4)
5. Against `in-progress` returns `{ok: false, reason: 'in-progress'}`; against `done` returns `{ok: false, reason: 'done'}`; roadmap unchanged. (Spec #5, #6)
6. Against a typo'd name, returns `{ok: false, reason: 'not-found', closestMatches: [...]}` (≤3, Levenshtein-ranked). (Spec #7)
7. Against a name hosted in 2+ milestones, returns `{ok: false, reason: 'ambiguous', matches: [...]}` (milestone-qualified). (Spec #8)
8. Summary is written only if the row summary is empty; `Plan`, `Assignee`, `Priority`, `External-ID`, `Blockers`, `Milestone` are preserved on non-backlog rows. (Spec #9, #10, D5)
9. `manage_roadmap action: 'promote'` is callable via MCP in both file-mode and file-less mode and returns the `PromoteResult` envelope verbatim; on success the file-mode handler writes `docs/roadmap.md`. (Spec #1, #11)
10. `harness-brainstorming` SKILL.md (all 4 platforms) Phase 4 calls `promote` (not `add`), branches on the envelope, and commits `proposal.md` + `SKILLS.md` + `roadmap.md` together. (Spec #14)
11. `promote.ts` and the new MCP handler branch do not call `emit_interaction` or any event-bus publisher (polling-only signaling). (Spec #13)
12. `docs/knowledge/roadmap/roadmap-promotion.md` and two ADRs exist and link; `harness validate` and `pnpm test` (core + cli) pass. (Spec gate)

## File Map

- CREATE `packages/core/src/roadmap/promote.ts`
- CREATE `packages/core/tests/roadmap/promote.test.ts`
- MODIFY `packages/core/src/roadmap/index.ts` (export promoteFeature + types)
- MODIFY `packages/cli/src/mcp/tools/roadmap.ts` (action enum, input union, handler, dispatch)
- MODIFY `packages/cli/src/mcp/tools/roadmap-file-less.ts` (action union, promote branch)
- MODIFY `packages/cli/tests/mcp/tools/roadmap.test.ts` (promote integration tests)
- MODIFY `agents/skills/claude-code/harness-brainstorming/SKILL.md`
- MODIFY `agents/skills/cursor/harness-brainstorming/SKILL.md`
- MODIFY `agents/skills/gemini-cli/harness-brainstorming/SKILL.md`
- MODIFY `agents/skills/codex/harness-brainstorming/SKILL.md`
- CREATE `docs/knowledge/roadmap/roadmap-promotion.md`
- CREATE `docs/knowledge/decisions/<NNNN>-roadmap-action-structured-envelopes.md`
- CREATE `docs/knowledge/decisions/<NNNN>-roadmap-rules-in-core.md`

## Changes to manage_roadmap (delta)

- **[ADDED]** `action: 'promote'` with inputs `feature` (required), `spec` (required), `summary` (optional).
- **[ADDED]** `promoteFeature` core function + `PromoteArgs`, `PromoteCoreResult`, `PromoteResult` types.
- **[ADDED]** file-less `promote` branch on the tracker client.
- **[MODIFIED]** `harness-brainstorming` Phase 4: step 7↔8 swap; `add` → `promote`; commit includes `roadmap.md`.
- **[MODIFIED]** nothing removed.

## Uncertainties

- [ASSUMPTION] `needs-human` status (present in `FeatureStatus`, absent from spec D2) is treated like `planned`/`blocked`: spec-updated, status preserved. Re-brainstorming a needs-human item is legitimate; it is neither active-dispatch nor terminal. If wrong, only the D2 mapping in Task 1 changes.
- [ASSUMPTION] Levenshtein helper is implemented locally in `promote.ts` (≈12 lines) rather than importing the entropy-domain `levenshteinDistance` from `drift.ts`, keeping the roadmap module cohesive and the entropy coupling out. If a shared util is later desired, extract then.
- [DEFERRABLE] File-less `promote` reuses `fetchAll` + `update`; concurrency/ETag contention is explicitly out of scope (spec S4-001, last-write-wins).

## Tasks

### Task 1 (TDD): Core promoteFeature — state machine, idempotency, field policy

**Depends on:** none | **Files:** `packages/core/src/roadmap/promote.ts`, `packages/core/tests/roadmap/promote.test.ts`

1. Write `packages/core/tests/roadmap/promote.test.ts` with a table covering every D2 cell (backlog→planned; not-found→`not-found`+closestMatches; planned→spec-updated; blocked→spec-updated; needs-human→spec-updated; in-progress→refuse; done→refuse), D4 (noop on identical spec; spec-updated on differing spec), D5 (summary written only when empty; Plan/Assignee/Priority/External-ID/Blockers/Milestone preserved), and D1 ambiguous (same heading in two milestones → `ambiguous` with milestone-qualified `matches`). Build `Roadmap` fixtures inline using the `@harness-engineering/types` shape.
2. Run `pnpm --filter @harness-engineering/core test -- promote` — observe failure (module missing).
3. Create `packages/core/src/roadmap/promote.ts`:
   - `PromoteArgs { feature: string; spec: string; summary?: string }`.
   - `PromoteCoreResult` and `PromoteResult` exactly as the spec's Core API.
   - `promoteFeature(roadmap, args): { result, nextRoadmap }`:
     - Trim + lowercase `args.feature`; collect all `(milestone, feature)` exact matches across `roadmap.milestones`.
     - 0 matches → `{ok:false, reason:'not-found', closestMatches: top≤3 by local levenshtein over all feature names}`, `nextRoadmap = roadmap` unchanged.
     - 2+ matches → `{ok:false, reason:'ambiguous', matches: ['<milestone> > <name>', ...]}`, unchanged.
     - 1 match → switch on `status`:
       - `in-progress` → `{ok:false, reason:'in-progress', detail}`, unchanged.
       - `done` → `{ok:false, reason:'done', detail}`, unchanged.
       - `backlog` → set `status='planned'`, `spec=args.spec`, summary if empty; result `transitioned:'backlog→planned'`.
       - `planned`/`blocked`/`needs-human` → if `spec === args.spec` AND status already non-backlog → `transitioned:'noop'` (no mutation); else set `spec=args.spec`, summary-if-empty, preserve status; `transitioned:'spec-updated'`.
     - Deep-clone the roadmap before mutating so `nextRoadmap` is a new object and the input is untouched (use `structuredClone`).
   - Private `editDistance(a,b)` + `closestMatches(name, all, k=3)` helpers (case-insensitive).
4. Run `pnpm --filter @harness-engineering/core test -- promote` — observe pass.
5. Run: `harness validate`.
6. Commit: `feat(core): add promoteFeature roadmap state-transition function`.

### Task 2: Export promoteFeature from core barrel

**Depends on:** Task 1 | **Files:** `packages/core/src/roadmap/index.ts`

1. Add to `packages/core/src/roadmap/index.ts`:
   ```ts
   /** Roadmap promotion: backlog → planned state transition (brainstorm-auto-promote). */
   export { promoteFeature } from './promote';
   export type { PromoteArgs, PromoteCoreResult, PromoteResult } from './promote';
   ```
2. Verify re-export resolves: `pnpm --filter @harness-engineering/core build` (or typecheck).
3. Run: `harness validate`.
4. Commit: `feat(core): export promoteFeature from roadmap barrel`.

### Task 3 (TDD): MCP file-mode promote action

**Depends on:** Task 2 | **Files:** `packages/cli/src/mcp/tools/roadmap.ts`, `packages/cli/tests/mcp/tools/roadmap.test.ts`

1. In `roadmap.test.ts` add tests: promote a `backlog` row → roadmap file updated to `planned` with spec; promote `in-progress` → `isError`/refusal envelope and file unchanged (`git`-free: compare file bytes); promote unknown → `not-found` with `closestMatches`. Assert the envelope is serialized into the response text.
2. Run `pnpm --filter @harness-engineering/harness test -- roadmap` (cli package) — observe new tests fail.
3. In `roadmap.ts`:
   - Add `'promote'` to the `action` enum (line ~23) and to the `ManageRoadmapInput['action']` union (line ~76).
   - Add `promoteFeature` to `RoadmapDeps` and to the dynamic `import('@harness-engineering/core')` destructure.
   - Add `handlePromote(projectPath, input, deps)`: require `feature` + `spec` (field error if missing); read + `parseRoadmap` (roadmapNotFoundError if missing; surface `write-failed` envelope on parse `Err`); call `promoteFeature`; if `result.ok` write serialized `nextRoadmap`; return `resultToMcpResponse(Ok(result))` (envelope verbatim, both ok and not-ok wrapped as a successful tool response carrying the structured result — refusals are data, not tool errors, matching the spec's "returns envelope verbatim").
   - Wire `case 'promote': return handlePromote(...)` in `dispatchAction`.
   - `shouldTriggerExternalSync`: `promote` is a write action, so external sync should fire only when `result.ok` — guard by inspecting the response; simplest is to keep it in the default write path (non-readonly) which already excludes errors. Confirm refusals don't mutate, so triggering sync is harmless but avoid it by treating a not-ok envelope as no-write (document inline).
4. Run cli roadmap tests — observe pass; run full `pnpm --filter @harness-engineering/harness test -- roadmap` to confirm existing tests still pass.
5. Run: `harness validate`.
6. Commit: `feat(cli): add manage_roadmap promote action (file mode)`.

### Task 4 (TDD): MCP file-less promote branch

**Depends on:** Task 3 | **Files:** `packages/cli/src/mcp/tools/roadmap-file-less.ts`, `packages/cli/tests/mcp/tools/roadmap.file-less.test.ts`

1. Add a file-less promote test (mock `RoadmapTrackerClient`): backlog feature → `update(id, {status:'planned', spec})`; in-progress feature → refusal, no `update` call.
2. Run the file-less test — observe failure.
3. In `roadmap-file-less.ts`:
   - Add `'promote'` to the `action` union and a `case 'promote': return handlePromote(input, client);`.
   - `handlePromote`: require `feature` + `spec`; `fetchAll`; map `TrackedFeature[]` into the in-memory `Roadmap` shape OR resolve the single feature and apply the same D2 decision inline by calling `promoteFeature` against a minimal constructed roadmap (preferred: construct a `Roadmap` from `fetchAll` features grouped by milestone, call `promoteFeature`, then translate the single changed row to a `client.update(externalId, patch)`); on refusal envelope, return the structured text without calling `update`.
   - Reuse `promoteFeature` from core for the decision so business rules stay single-sourced (D6).
4. Run file-less tests — observe pass.
5. Run: `harness validate`.
6. Commit: `feat(cli): add manage_roadmap promote branch (file-less mode)`.

### Task 5: Update tool description for promote

**Depends on:** Task 4 | **Files:** `packages/cli/src/mcp/tools/roadmap.ts`

1. Update `manageRoadmapDefinition.description` to mention `promote`, and the `feature`/`spec`/`summary` field descriptions to note they are used by `promote`.
2. Run: `harness validate`.
3. Commit: `docs(cli): document promote in manage_roadmap tool schema`.

### Task 6: Brainstorming SKILL.md Phase 4 rewrite — claude-code

**Depends on:** Task 3 | **Files:** `agents/skills/claude-code/harness-brainstorming/SKILL.md` | **Category:** integration

1. Swap Phase 4 step 7 (commit) and step 8 (roadmap). New step 7 = call `manage_roadmap action: 'promote'` with `feature` = ARGUMENTS string, `spec` = `docs/changes/<feature>/proposal.md`, `summary` = H1, with the full envelope-branch table from the spec (Technical Design → SKILL.md changes table). New step 8 = `git add proposal.md SKILLS.md docs/roadmap.md` + commit `docs(<feature>): add spec and promote to planned`. Note STOP cases skip step 9.
2. Run: `harness validate`.
3. Commit (deferred to Task 8 batch to keep the 4 platform edits in one reviewable commit) — stage only.

### Task 7: Mirror SKILL.md edits — cursor, gemini-cli, codex

**Depends on:** Task 6 | **Files:** `agents/skills/{cursor,gemini-cli,codex}/harness-brainstorming/SKILL.md` | **Category:** integration

1. Apply the byte-identical Phase 4 edit (sections only; preserve per-platform frontmatter) to the three remaining variants.
2. `diff` the four modified Phase 4 sections to confirm parity (Spec #14).
3. Run: `harness validate`.
4. Commit: `docs(brainstorming): promote roadmap row in Phase 4 across all platforms`.

### Task 8: Knowledge doc — roadmap-promotion.md

**Depends on:** Task 4 | **Files:** `docs/knowledge/roadmap/roadmap-promotion.md` | **Category:** integration

1. Write the knowledge doc: the `promote` action, `PromoteResult` envelope shape, the D2 state-transition table, caller examples (brainstorming today; autopilot/dashboard later). Match the frontmatter/structure of an existing `docs/knowledge/roadmap/*.md` file (e.g. `tracker-as-source-of-truth.md`).
2. Run: `harness validate` and `harness check-docs`.
3. Commit: `docs(knowledge): document roadmap promotion action`.

### Task 9: ADRs — structured envelopes + rules-in-core

**Depends on:** Task 8 | **Files:** `docs/knowledge/decisions/<NNNN>-roadmap-action-structured-envelopes.md`, `docs/knowledge/decisions/<NNNN>-roadmap-rules-in-core.md` | **Category:** integration

1. Determine the next ADR numbers from `docs/knowledge/decisions/` (highest existing + 1, +2). Match the existing ADR template/frontmatter.
2. ADR A: `manage_roadmap` state-changing actions return structured `{ok, reason, detail, ...}` envelopes. Context/decision/consequences/rationale per spec Integration Points → Architectural Decisions #1.
3. ADR B: roadmap state-transition rules live in `@harness-engineering/core`, not skill markdown (D6) — Architectural Decisions #2.
4. Cross-link both ADRs from `roadmap-promotion.md`.
5. Run: `harness validate` and `harness check-docs`.
6. Commit: `docs(decisions): add ADRs for roadmap promotion envelopes and rules-in-core`.

## Sequencing

```
Task 1 (core fn) → Task 2 (export) → Task 3 (MCP file) → Task 4 (MCP file-less) → Task 5 (schema docs)
                                          ↘ Task 6 (skill cc) → Task 7 (skill 3x)
                                          ↘ Task 8 (knowledge) → Task 9 (ADRs)
```

Tasks 1–5 are the implementation spine. Tasks 6–7 are the skill cut-over (integration). Tasks 8–9 are knowledge materialization (integration, `large` tier). Total ~9 tasks, ~40 minutes.

## Notes

- Polling-only signaling (Spec #13): neither `promote.ts` nor the MCP handler branch may import `emit_interaction` or an event-bus publisher. Verify with grep in the verification phase.
- Atomicity (Spec #11): the single-commit invariant is enforced by SKILL.md step 8 staging all three files; the code change does not commit on its own.
