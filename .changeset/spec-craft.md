---
'@harness-engineering/cli': minor
---

Add **spec-craft** — second member of the craft-pipeline initiative (sub-project #6 of 10). LLM-judgment skill for spec quality. Highest-leverage craft skill because spec quality compounds across the entire planning → implementation → review lifecycle below it. Triggered the v2 extraction of shared craft infrastructure: this PR moves `LlmProvider` + 3-axis types + `derivePriority` to `packages/cli/src/shared/craft/` so design-craft + naming-craft + spec-craft (and every future craft skill) import from one canonical home.

**Three decisions locked:**

1. **v1 spec scope: proposals + ADRs.** `docs/changes/*/proposal.md` + `docs/knowledge/decisions/*.md`. Excludes READMEs / general docs (docs-craft #2 territory). RFCs deferred to v1.x.
2. **Per-section critique.** Specs parsed by H2 into named sections; rubrics declare which canonical section names they apply to. Localized findings (`Decisions:34 is vague`) beat doc-scoped findings (`spec is vague`). Better cost control + signal quality than whole-doc critique.
3. **Shared craft extraction NOW.** Second non-design craft consumer triggers the extraction (noted in naming-craft's changeset). Stops the duplication pattern at 2 consumers; `LlmProvider` + `MockLlmProvider` + 3-axis types + `derivePriority` move to `packages/cli/src/shared/craft/`. design-craft and naming-craft keep their old import paths via re-export shims (zero behavior change).

**7 seed rubrics** (one file per rubric, matches naming-craft layout):

- `SPEC-R001` **sharpness vs vagueness** — applies to all sections
- `SPEC-R002` **cuts at the joints** — decisions, scope, technical-design
- `SPEC-R003` **two readers, same understanding** — decisions, success-criteria
- `SPEC-R004` **load-bearing vs ambient context** — decisions, overview
- `SPEC-R005` **honest rationalizations** — rationalizations\* (regex)
- `SPEC-R006` **non-goals are non-goals** — out-of-scope* / non-goals* (regex)
- `SPEC-R007` **stranger in 6 months** — applies to all sections

**Honors ADRs 0018-0021:** confidence first-class, 3-axis preserved, `cite.rubricId` on every finding for catalog usage signal.

**Cross-cutting:** `critiqueSpecFile(file, opts)` exported so future craft skills (or `harness-brainstorming`) can invoke spec critique on a doc they're already processing without re-walking the project.

**Shared craft extraction (cross-cutting, zero behavior change):**

- New: `packages/cli/src/shared/craft/llm/provider.ts` — `LlmProvider`, `LlmCallCost`, `MockLlmProvider`, `getProvider`
- New: `packages/cli/src/shared/craft/findings/axes.ts` — `Tier`, `Impact`, `Confidence`
- New: `packages/cli/src/shared/craft/findings/derived.ts` — `derivePriority`
- `packages/cli/src/design-craft/llm/provider.ts` becomes a re-export shim
- `packages/cli/src/design-craft/findings/derived.ts` becomes a re-export shim
- `packages/cli/src/design-craft/findings/schema.ts` imports the 3-axis types from shared and re-exports them
- `packages/cli/src/naming-craft/llm/provider.ts` + `findings/derived.ts` + `findings/schema.ts` now import directly from shared (no longer from design-craft)

All existing design-craft + naming-craft tests pass unchanged (846/846 across the cli suite).

**Surface area:**

- `harness spec-craft` CLI command (`--files` / `--kinds` / `--sections` / `--max-files` / `--max-sections-per-file` / `--json`)
- `spec_craft` MCP tool (count 75 → 76)
- 4-platform skill markdown (claude-code / codex / cursor / gemini-cli)
- New `craft.spec.{enabled, maxFiles, maxSectionsPerFile}` config block under the `craft.*` namespace

**Tests:** 32 new tests across section parser, rubric mapping, spec discovery, critique phase, and end-to-end pipeline (mock LLM). 846 tests pass across the cli suite. Smoke-tested end-to-end against the repo's own specs: 5 docs scanned, 32 sections parsed, 94 findings emitted (7 rubrics × applicable sections); mock provider's deterministic low-confidence response preserves ADR 0019's honesty contract.

**Long-term trajectory:**

- v1.x: doc-level summary mode; RFC docs; POLISH phase (concrete rewrites of weak sections); per-project rubric override config; `align-spec` sibling FIX skill; per-section opt-out via `<!-- spec-craft:skip -->`.
- v2: integration with `harness-brainstorming` so freshly-authored specs get critique inline; integration with `harness-soundness-review` for floor + ceiling paired runs.
- v3: cross-spec consistency rubrics (e.g., is this spec's `Decisions` honest about constraints declared in an upstream ADR?).
