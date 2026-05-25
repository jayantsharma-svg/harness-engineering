# spec-craft v1

> Second member of the craft-pipeline initiative (sub-project #6 of 10). LLM-judgment skill for spec quality — the ceiling counterpart to `harness-soundness-review` (which checks structural floor: required sections present, success criteria observable, integration points populated). spec-craft critiques whether a spec is sharp or vague, cuts at the joints, would lead two readers to the same understanding, has honest rationalizations, and would still be actionable to a stranger in 6 months. Highest-leverage craft skill because spec quality compounds across the entire planning → implementation → review lifecycle below it. Triggers the v2 extraction of shared craft infrastructure: this PR moves `LlmProvider` + 3-axis types + `derivePriority` to `packages/cli/src/shared/craft/` so naming-craft + design-craft + spec-craft (and every future craft skill) all import from one canonical location.

## Overview

**Project:** spec-craft (v1)
**Initiative:** craft-pipeline (sub-project #6 of 10 — the second non-design craft skill, after naming-craft)
**Date:** 2026-05-25
**Estimated effort:** ~1 week, single PR
**Triggers:** the v2 shared-craft extraction (this PR does the extraction)

### What this ships

A new skill + CLI command + MCP tool that:

1. Discovers spec files: `docs/changes/*/proposal.md` + `docs/knowledge/decisions/*.md`.
2. Parses each spec into named sections (Overview, Decisions, Scope, Success criteria, Rationalizations, Open questions, etc.) via markdown H2 headings.
3. For each (section, rubric) pair where the rubric applies, invokes an LLM with a curated rubric catalog (7 seed rubrics from the spec-quality canon).
4. Emits 3-axis `SpecFinding`s (tier × impact × confidence per ADR 0019) — never collapsed to single severity.
5. Records catalog usage signal per ADR 0020.

Also: moves the craft-family shared infrastructure (`LlmProvider`, `MockLlmProvider`, `Tier`/`Impact`/`Confidence`, `derivePriority`) from `packages/cli/src/design-craft/` to `packages/cli/src/shared/craft/`. design-craft and naming-craft re-export from shared so external import paths stay stable; new craft skills import from shared directly.

### What this does NOT ship

- **No critique of READMEs / general docs.** Those belong to docs-craft (#2). spec-craft is for spec-format docs (proposals + ADRs).
- **No whole-doc critique.** Per-section is the v1 contract — localized findings, rubric-to-section mapping, parallelizable cost. v1.x may add a doc-level "summary findings" mode.
- **No autofix.** Suggesting a rewrite of a spec section is a craft act; v2 may add a `align-spec` sibling if signal warrants.
- **No spec-template enforcement.** That's harness-soundness-review's floor (structural). spec-craft assumes the floor is satisfied and critiques the ceiling.
- **No B' detect-and-offer.** Same posture as naming-craft v1; the B' pattern is design-craft's premier infrastructure and isn't yet generalized.
- **No graph persistence.** Phase 1 MVP posture (matches design-craft, naming-craft).
- **No multi-language support.** Specs are markdown; the markdown parser is the only "language."
- **No RFC docs.** RFC structure varies more than proposals; v1.x.
- **No vision/deep mode.** Specs are text-only.

### What problem this solves

The harness codebase has accumulated ~50 specs (proposals + ADRs) over the design-pipeline + craft-pipeline + Hermes initiatives. `harness-soundness-review` enforces structural floor — that the right sections exist, that success criteria are observable, that integration points are populated. That's necessary but insufficient. The actual quality of a spec — whether the decisions are sharp, whether the rationalizations are honest, whether a stranger could pick it up in 6 months — has been entirely a function of who wrote it. spec-craft puts the ceiling questions into the loop: not "does this spec have a Decisions section?" but "does the Decisions section name the load-bearing trade-offs or just narrate the chosen path?" It's the highest-leverage craft skill because every spec drives implementation, review, and ongoing maintenance — sharper specs make every downstream phase cheaper.

## Decisions

| #   | Decision                | Lock                                                            | Rationale                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | v1 spec scope           | **proposals + ADRs**                                            | Two doc kinds with similar shape (decisions + rationale + criteria). Excludes READMEs / general docs (docs-craft territory). Covers the real spec-authoring surface in this repo today.                                                                                                                    |
| 2   | Critique granularity    | **per-section**                                                 | Localized findings (`Decisions[2] is vague` beats `the spec is vague`). Maps rubrics to relevant sections — `honest-rationalizations` only runs on `## Rationalizations to reject`; `non-goals-honesty` only on `## Out-of-scope`. Better cost control; can skip Open Questions; can drill into Decisions. |
| 3   | Shared craft extraction | **Extract `packages/cli/src/shared/craft/` AS PART OF this PR** | Second non-design craft consumer triggers the extraction (noted in naming-craft's changeset). Stops the duplication pattern at 2 consumers (right before it metastasizes). 3-PR refactor: extract + update naming-craft imports + update design-craft imports. Small, mechanical, zero behavior.           |

## Scope

### In-scope

- **Spec discovery.** Glob `docs/changes/*/proposal.md` and `docs/knowledge/decisions/*.md` from project root. v1 also accepts `--files` for explicit scoping.
- **Markdown section parser.** Splits a spec by H2 (`## ...`) into named sections. Each section captures its heading, body content, and absolute line range. Subsections (H3) are kept as part of the parent H2 body.
- **7 seed rubrics** (default catalog):
  - `SPEC-R001` **sharpness vs vagueness** — does the section state specific things or wave at them?
  - `SPEC-R002` **cuts at the joints** — does the decomposition match the natural boundaries of the problem?
  - `SPEC-R003` **two-readers same understanding** — could two reasonable readers extract the same load-bearing meaning?
  - `SPEC-R004` **load-bearing decision vs ambient context** — is the section signal-rich, or does it pad load-bearing decisions with background that obscures them?
  - `SPEC-R005` **honest rationalizations** — when the Rationalizations-to-reject section is critiqued, are the rejected arguments stated charitably (steelmanned) or strawmanned?
  - `SPEC-R006` **non-goals are non-goals** — does the Out-of-scope section list real trade-offs the project made, or does it smuggle assumptions disguised as non-goals?
  - `SPEC-R007` **stranger-in-6-months** — could a stranger picking up this spec 6 months from now still act on it without parallel context?
- **Per-section rubric mapping.** Each rubric declares which section names it applies to (regex / canonical names). The orchestrator skips (rubric, section) pairs that don't match.
- **3-axis `SpecFinding`** matching the shared craft shape: tier × impact × confidence + cite + derived priority + target.
- **Shared craft extraction** at `packages/cli/src/shared/craft/`:
  - `llm/provider.ts` — `LlmProvider`, `LlmCallCost`, `MockLlmProvider`, `getProvider`
  - `findings/axes.ts` — `Tier`, `Impact`, `Confidence`, `VerifierSeverity` (alias)
  - `findings/derived.ts` — `derivePriority`
- **Backward compatibility:** design-craft + naming-craft keep their existing import paths via re-exports (e.g., `design-craft/llm/provider.ts` becomes `export * from '../../shared/craft/llm/provider.js'`). Zero external API change.
- **CLI:** `harness spec-craft`.
- **MCP tool:** `spec_craft` (count 75 → 76).
- **4-platform skill markdown.**
- **Config block:** `craft.spec.{enabled, maxFiles, maxSectionsPerFile}` under the new `craft.*` namespace (introduced by naming-craft).

### Out-of-scope (v1)

- **No autofix.** Sibling `align-spec` deferred.
- **No README / general doc critique.** docs-craft (#2) territory.
- **No whole-doc critique mode.** Per-section is the contract; v1.x may add a doc-level summary.
- **No RFC docs.** v1.x.
- **No B' bootstrap.** Same posture as naming-craft.
- **No graph persistence.** Phase 1 MVP.
- **No deep/vision mode.** Text-only.
- **No critique of inline JSDoc / source-code comments.** code-craft (#4) and docs-craft (#2) territory.

## Inputs

- **Project root path** (CLI / MCP arg).
- **harness.config.json** — `craft.spec.{enabled, maxFiles, maxSectionsPerFile}` (new sub-block under `craft.*`).
- **LLM provider** (`MockLlmProvider` in v1; same posture as naming-craft + design-craft Phase 1).

## Outputs

```ts
interface SpecFinding {
  /** Stable code in SPEC-R\d{3} namespace. */
  code: string;
  phase: 'critique';
  tier: 'foundational' | 'polish' | 'aspirational';
  impact: 'small' | 'medium' | 'large';
  confidence: 'high' | 'medium' | 'low';
  target: {
    file: string;
    /** H2 heading text (e.g., "Decisions"). */
    section: string;
    /** First line of the section's body (1-indexed). */
    line: number;
  };
  message: string;
  cite: { rubricId: string; source: string };
  derived: { priority: number };
}

interface SpecCraftOutput {
  findings: SpecFinding[];
  summary: {
    phaseRun: ['critique'];
    mode: 'fast';
    durationMs: number;
    llmCalls: { provider: string; model: string; count: number; costUsd: number };
    catalog: { rubricsApplied: string[] };
    docsScanned: number;
    sectionsScanned: number;
    runId: string;
  };
}
```

## Technical Design

### Module layout

```
packages/cli/src/shared/craft/         # NEW — extracted from design-craft
  llm/
    provider.ts                        # LlmProvider, LlmCallCost, MockLlmProvider, getProvider
  findings/
    axes.ts                            # Tier, Impact, Confidence types
    derived.ts                         # derivePriority(tier, impact, confidence)

packages/cli/src/spec-craft/
  findings/
    schema.ts                          # SpecFinding, SpecCraftOutput
  catalog/
    rubrics/
      sharpness.ts                     # SPEC-R001
      joints.ts                        # SPEC-R002
      two-readers.ts                   # SPEC-R003
      load-bearing.ts                  # SPEC-R004
      honest-rationalizations.ts       # SPEC-R005
      non-goals-honesty.ts             # SPEC-R006
      stranger-in-6-months.ts          # SPEC-R007
    index.ts                           # rubric registry + section-mapping helpers
  extract/
    sections.ts                        # markdown H2 splitter
    discover.ts                        # glob proposals + ADRs
  phases/
    critique.ts                        # LLM critique loop
  index.ts                             # runSpecCraft + critiqueSpecFile

packages/cli/src/mcp/tools/
  spec-craft.ts                        # MCP tool wrapper

packages/cli/src/commands/
  spec-craft.ts                        # CLI command

agents/skills/{4 platforms}/spec-craft/
  SKILL.md
  skill.yaml
```

### Shared/craft extraction details

**Files moved:**

- `packages/cli/src/design-craft/llm/provider.ts` → `packages/cli/src/shared/craft/llm/provider.ts`
- `packages/cli/src/design-craft/findings/derived.ts` → `packages/cli/src/shared/craft/findings/derived.ts`
- The `Tier` / `Impact` / `Confidence` types currently live in `packages/cli/src/design-craft/findings/schema.ts` — those specific exports move to `packages/cli/src/shared/craft/findings/axes.ts`. The `CraftFinding` design-specific type STAYS in design-craft (it's design-domain-specific).

**Re-export shims** (zero external breakage):

- `packages/cli/src/design-craft/llm/provider.ts` becomes a one-liner: `export * from '../../shared/craft/llm/provider.js';`
- `packages/cli/src/design-craft/findings/derived.ts` becomes: `export * from '../../shared/craft/findings/derived.js';`
- `packages/cli/src/naming-craft/llm/provider.ts` and `packages/cli/src/naming-craft/findings/derived.ts` already re-export from design-craft; updated to re-export from shared instead.

**Migration tactic:** import paths are file-level; TypeScript compile catches mismatches; tests for both design-craft and naming-craft must still pass after the move. No runtime behavior change.

### Section parser

```ts
interface ParsedSection {
  heading: string; // 'Decisions' (without leading "## ")
  canonical: string; // lowercased + normalized: 'decisions', 'success-criteria', etc.
  body: string;
  line: number; // first line of body content (1-indexed)
  endLine: number; // last line of section (exclusive of next H2)
}

function parseSections(markdown: string): ParsedSection[];
```

Rules:

- H2 (`## ...`) starts a new section.
- H1 / H3 / H4 do not start sections (H3 is treated as subsection content under the enclosing H2).
- Section body = everything after the H2 line until the next H2 (or EOF).
- Frontmatter (`--- ... ---` at top of file) is stripped before parsing.

### Section name canonicalization

Maps a heading to a canonical form for rubric matching:

```ts
function canonicalize(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Examples:
canonicalize('Decisions'); // 'decisions'
canonicalize('Out-of-scope (v1)'); // 'out-of-scope-v1'
canonicalize('Rationalizations to reject'); // 'rationalizations-to-reject'
canonicalize('Success criteria'); // 'success-criteria'
```

### Rubric → section mapping

Each rubric declares its target sections via canonical name OR regex pattern:

```ts
interface SpecRubric extends NamingRubricBase {
  id: string;
  title: string;
  description: string;
  source: string;
  /** Section canonical names this rubric applies to. Use ['*'] for all sections. */
  appliesToSections: string[] | RegExp[];
  // ... ADR 0020 catalog fields (contribution, signal, version)
}
```

v1 mappings (per rubric):

| Rubric                            | Applies to                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| SPEC-R001 sharpness               | `['*']` — all sections                                                             |
| SPEC-R002 joints                  | `['decisions', 'scope', 'technical-design']`                                       |
| SPEC-R003 two-readers             | `['decisions', 'success-criteria']`                                                |
| SPEC-R004 load-bearing            | `['decisions', 'overview']`                                                        |
| SPEC-R005 honest-rationalizations | `[/^rationalizations/]` — matches "Rationalizations to reject", "Rationalizations" |
| SPEC-R006 non-goals-honesty       | `[/^out-of-scope/, /^non-goals/]`                                                  |
| SPEC-R007 stranger-in-6-months    | `['*']` — all sections                                                             |

### Critique phase

For each (spec file, section, rubric) triple where the rubric applies:

1. Build prompt: rubric description + section heading + section body (truncated if > 2000 chars to control cost) + spec file path for context.
2. LLM returns fenced JSON: `null` (rubric doesn't apply or section is fine) OR `{ tier, impact, confidence, message }`.
3. On non-null: emit `SpecFinding` with `cite.rubricId` populated.

Cost control: per-file caps `maxSectionsPerFile` (default 10) so docs with 30 sections don't balloon. Skipped sections logged but not findings-emitted.

### Cross-cutting use

```ts
// packages/cli/src/spec-craft/index.ts
export async function runSpecCraft(input: SpecCraftInput): Promise<SpecCraftOutput>;
export async function critiqueSpecFile(
  file: string,
  opts?: { source?: string; sections?: string[]; rubrics?: SpecRubric[]; provider?: LlmProvider }
): Promise<SpecFinding[]>;
```

`critiqueSpecFile` mirrors `critiqueNamesInFile` — used by future craft skills (or harness-brainstorming) that want spec critique on a doc they're already processing without re-walking.

## Surface area

### CLI

```
harness spec-craft [options]
  --files <files...>                Optional spec file/glob scope
  --kinds <kinds...>                Restrict to proposal / adr (default: both)
  --sections <names...>             Restrict to specific canonical section names
  --max-files <n>                   Cap doc count (default: 50)
  --max-sections-per-file <n>       Cap per-doc section critique (default: 10)
  --json
  --verbose / --quiet
```

Exit codes:

- `0` — no foundational-tier findings
- `1` — at least one foundational-tier finding
- `2` — crashed

### MCP tool

`spec_craft` — same input/output shape as the function call. Count 75 → 76.

### Config

```ts
craft.spec: {
  enabled: boolean;                // default true
  maxFiles: number;                // default 50
  maxSectionsPerFile: number;      // default 10
}
```

## Rationalizations to reject

| Rationalization                                                      | Why it's wrong                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Whole-doc critique is cheaper — use one LLM call per spec"          | Cheaper per-doc, more expensive per-finding. Localized findings are the actionable unit; doc-scoped findings ("this spec is vague") aren't.                                                            |
| "Include READMEs — they're specs too"                                | READMEs have different craft criteria (teach, onboard, navigate). docs-craft #2 owns READMEs.                                                                                                          |
| "Defer the shared/craft extraction to v2"                            | Already noted as the v2 trigger in naming-craft's changeset. Deferring past 2 consumers means 3 consumers when test-craft lands, then refactor across 3 PRs instead of cleanly here.                   |
| "Add B' detect-and-offer (offer to write a spec stub if none exist)" | Out of scope. spec-craft critiques existing specs; authoring is harness-brainstorming's job.                                                                                                           |
| "Critique the source-code comments + JSDoc as 'specs'"               | code-craft + docs-craft territory.                                                                                                                                                                     |
| "Use a unified CRAFT-S\d{3} code namespace shared with naming-craft" | Per-skill namespace (NAME-R\d{3}, SPEC-R\d{3}) keeps debugging local. Convergence is v2 if it pays off.                                                                                                |
| "Run all 7 rubrics on every section regardless of mapping"           | Rubric-to-section mapping is the cost-control + signal-quality lever. 'honest rationalizations' on the Overview section is noise.                                                                      |
| "Require harness-soundness-review to pass before spec-craft runs"    | Coupling. Soundness checks the floor; craft checks the ceiling. They can fire independently — a structurally-broken spec might still have salvageable rubrics, and the ones that fail will be obvious. |
| "Critique frontmatter as a section"                                  | Frontmatter is metadata, not prose. Strip and skip.                                                                                                                                                    |
| "Include design-craft's CraftFinding type in shared/craft"           | CraftFinding has design-specific fields (component, page). The 3-axis primitives (tier/impact/confidence) go in shared; the per-skill finding type stays per-skill.                                    |

## Success criteria

**Section parser (6)**

1. `parseSections(markdown)` splits a doc by H2 into sections
2. Returns canonical name per section (`Decisions` → `decisions`)
3. Captures correct line range (line and endLine) per section
4. H3/H4 stay as subsection content under their enclosing H2
5. Frontmatter (`--- ... ---`) is stripped before parsing
6. Document with zero H2s returns empty array (no findings emitted)

**Rubric mapping (4)**

7. `appliesToSections: ['*']` matches every section
8. `appliesToSections: ['decisions']` matches only sections canonicalized to 'decisions'
9. `appliesToSections: [/^rationalizations/]` regex matches 'rationalizations' and 'rationalizations-to-reject'
10. Non-matching sections skip silently (rubric not invoked)

**Catalog + critique (10)**

11. 7 seed rubrics ship at `catalog/rubrics/<id>.ts` (file-per-rubric, matches naming-craft)
12. `runSpecCraft({ path })` walks proposals + ADRs and produces a SpecCraftOutput
13. Mock LLM provider's deterministic response produces a valid SpecFinding
14. Each finding includes `cite.rubricId` (ADR 0020)
15. `tier × impact × confidence` axes present (ADR 0019)
16. `derived.priority` computed via shared/craft's derivePriority
17. Per-file section count capped at maxSectionsPerFile (default 10)
18. Per-project file count capped at maxFiles (default 50)
19. LLM `null` response does NOT emit a finding
20. Cost telemetry: `summary.llmCalls.{count, costUsd}` populated

**Shared/craft extraction (6)**

21. `packages/cli/src/shared/craft/llm/provider.ts` exists and exports `LlmProvider`, `LlmCallCost`, `MockLlmProvider`, `getProvider`
22. `packages/cli/src/shared/craft/findings/axes.ts` exists and exports `Tier`, `Impact`, `Confidence`
23. `packages/cli/src/shared/craft/findings/derived.ts` exists and exports `derivePriority`
24. design-craft's `provider.ts` and `derived.ts` become re-export shims (existing imports keep working)
25. naming-craft's `llm/provider.ts` and `findings/derived.ts` re-export from shared (no longer from design-craft)
26. All existing design-craft + naming-craft tests still pass (zero behavior change verification)

**Cross-cutting API (2)**

27. `critiqueSpecFile(file, opts)` exported and invocable independently of project walk
28. Accepts `sections` filter (e.g., only critique Decisions)

**Surface area (4)**

29. New MCP tool `spec_craft` registered (count 75 → 76)
30. New CLI command `harness spec-craft` registered
31. 4-platform skill markdown shipped
32. New config block `craft.spec.*` validates round-trip

**Discovery (2)**

33. Discovers `docs/changes/*/proposal.md` AND `docs/knowledge/decisions/*.md`
34. Empty project (no proposals, no ADRs) returns empty findings + zero LLM calls

## Long-term trajectory

- **v1.x — doc-level summary findings** as an opt-in mode alongside per-section.
- **v1.x — RFC docs** + per-doc-type rubric mappings.
- **v1.x — POLISH phase** suggesting concrete rewrites of weak sections (mirrors design-craft's POLISH).
- **v1.x — per-project rubric override config.**
- **v1.x — `align-spec` sibling FIX skill** for safe-to-apply rewrites (e.g., promoting a buried decision into the Decisions table).
- **v2 — Integration with `harness-brainstorming`** so freshly-authored specs get craft critique inline.
- **v2 — Integration with `harness-soundness-review`** so floor + ceiling run as a paired check.
- **v3 — Cross-spec consistency rubrics** (e.g., is this spec's `Decisions` honest about constraints declared in an upstream ADR?).

## Risks + mitigations

| Risk                                                                           | Mitigation                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared/craft extraction breaks design-craft or naming-craft import paths       | Re-export shims preserve original import paths; full test runs of both skills are part of the PR's gate. Any test failure = revert the extraction half and ship spec-craft with the import-from-design-craft pattern. |
| LLM cost balloons on large spec corpus                                         | Per-file caps (maxSectionsPerFile=10) + per-project cap (maxFiles=50). Rubric-to-section mapping further reduces calls.                                                                                               |
| False positives on intentionally-vague sections (e.g., aspirational Overviews) | Low-confidence findings de-emphasized per ADR 0019. v1.x adds per-section opt-out via `<!-- spec-craft:skip -->` HTML comment.                                                                                        |
| Section parser misclassifies a doc with non-standard headings                  | Canonical name uses regex-tolerant matching; rubric mapping is lenient (regex patterns). Non-mapped sections silently skip (no false findings).                                                                       |
| Mock provider default response is too noisy in test output                     | Same posture as naming-craft — confidence:low responses are visible but understood as mock-deterministic. Tests assert via override responses, not default.                                                           |
| Rubric set drift over time                                                     | Rubric registry is source of truth; tests assert exactly 7 seed rubrics; catalog growth is code-change event in v1.                                                                                                   |
| Spec file discovery picks up generated proposals / drafts                      | Glob is path-scoped (docs/changes / docs/knowledge/decisions only); drafts in other locations are out of scope. v1.x adds frontmatter `status: draft` skip.                                                           |

## Open questions deferred to implementation

- **Section-body truncation length.** Spec says 2000 chars. Implementation chooses; tunable per-config if signal warrants.
- **Subsection (H3) handling.** v1 keeps as part of parent H2 body. v1.x may add per-H3 critique for sections like "Decisions" that have one row per H3.
- **Frontmatter format.** Strip YAML-style `--- ... ---` only. TOML-style and others deferred to v1.x.
  EOF
