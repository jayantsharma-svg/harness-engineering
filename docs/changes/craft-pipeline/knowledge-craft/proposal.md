# knowledge-craft v1

> Fifth member of the craft-pipeline initiative (sub-project #9 of 10). LLM-judgment skill for knowledge-entry quality — the ceiling counterpart to `harness-knowledge-pipeline` (procedural ingestion + reconciliation) and `harness-detect-doc-drift` (structural). Critiques `docs/knowledge/` entries against rubrics like "does this state a load-bearing FACT or paraphrase the code?", "would deleting lose anything specific?", "does it earn its place in the graph as `business_fact` / `business_rule` / `business_concept`?". Imports shared craft infrastructure from `packages/cli/src/shared/craft/`.

## Overview

**Project:** knowledge-craft (v1)
**Initiative:** craft-pipeline (sub-project #9 of 10 — fifth non-design craft skill)
**Date:** 2026-05-26
**Estimated effort:** ~3-4 days, single PR (smallest remaining sub-project)
**Composes with:** harness-knowledge-pipeline (rule-based floor), spec-craft (which owns ADRs)

### What this ships

A new skill + CLI command + MCP tool that:

1. Discovers knowledge entries under `docs/knowledge/`, EXCLUDING `docs/knowledge/decisions/` (which is spec-craft's territory).
2. Reads each entry as a whole-file unit (per-file critique granularity).
3. Invokes an LLM with a curated rubric catalog (7 seed rubrics) referencing the graph taxonomy without reading the graph itself.
4. Emits 3-axis `KnowledgeFinding`s (tier × impact × confidence per ADR 0019).

### What this does NOT ship

- **No ADR critique.** `docs/knowledge/decisions/*.md` is spec-craft territory. Critiquing the same files twice produces noise.
- **No AGENTS.md critique.** AGENTS.md is a navigational manifest, not a fact-bearing entry. Different rubric vocabulary (orientation, table-of-contents quality); v1.x.
- **No graph reads.** v1 references graph node types (`business_fact`, `business_rule`, `business_concept`) inside rubric descriptions so the LLM critiques against the taxonomy, but knowledge-craft never queries the graph itself. Avoids runtime dependency on harness-knowledge-pipeline.
- **No autofix.** Sibling `align-knowledge` deferred to v2.
- **No per-section critique.** Knowledge entries are typically 1-3 sections; per-section adds prompt overhead without localization gain.
- **No per-claim text-level extraction.** Per-claim rubrics ("is THIS sentence a fact or paraphrase?") balloon LLM costs; v1.x with smarter chunking.
- **No B' bootstrap.** Same posture as the rest of the craft family.
- **No graph persistence of findings.** Phase 1 MVP.

### What problem this solves

`docs/knowledge/` accumulates entries that range from "load-bearing fact that's not derivable from reading the code" (great) to "paraphrase of what foo.ts does" (rot in slow motion). `harness-knowledge-pipeline` ingests entries into the graph; `harness-detect-doc-drift` flags stale references. Neither says anything about whether an entry EARNS its place. knowledge-craft puts the canonical knowledge-quality rubrics (load-bearing-fact vs paraphrase, carries-forward-decision, truth-not-derivable, earns-graph-place) into the loop with concrete per-entry findings: "this entry restates the file it documents — delete or rewrite to capture the WHY"; "this entry says 'our convention is X' but doesn't say WHY X over Y — the reader can't apply judgment in adjacent cases".

## Decisions

| #   | Decision          | Lock                                                 | Rationale                                                                                                                                                                                                                                                           |
| --- | ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | v1 scope          | **`docs/knowledge/` excluding `decisions/`**         | Natural scope; explicit exclusion of `decisions/` (which is spec-craft's territory) avoids double-counting findings on ADRs. AGENTS.md deferred (different shape: navigational vs fact-bearing).                                                                    |
| 2   | Granularity       | **Per-file**                                         | Knowledge entries are typically focused single-topic docs (1-3 sections); per-file aligns with how knowledge authors think. Per-section adds prompt overhead without localization gain at this scale. Per-claim is too noisy + expensive.                           |
| 3   | Graph integration | **Reference graph types in rubrics, no graph reads** | KNOW-R003 (earns-graph-place) references `business_fact` / `business_rule` / `business_concept` in the LLM prompt; the LLM critiques against the taxonomy without knowledge-craft having a runtime graph dependency. Avoids coupling to harness-knowledge-pipeline. |

## Scope

### In-scope

- **Entry discovery.** Walk `docs/knowledge/`; include `*.md` files; EXCLUDE entries under `decisions/` subdir (spec-craft territory). Honors `--files` override for explicit scoping.
- **Per-file critique** with whole-file content (truncated to 4000 chars in prompt for cost).
- **7 seed rubrics**:
  - `KNOW-R001` **load-bearing-fact** — does the entry state a load-bearing FACT about the domain, or does it paraphrase what the code already says?
  - `KNOW-R002` **truth-not-derivable** — is the entry stating a truth a code reader couldn't infer from reading the code itself? (constraints, invariants, "this is the way it works")
  - `KNOW-R003` **earns-graph-place** — would this entry fit as `business_fact` / `business_rule` / `business_concept` / `business_decision` in the knowledge graph, or is it scratchpad-quality?
  - `KNOW-R004` **carries-forward-decision** — does the entry carry forward a decision that would otherwise erode (the WHY of a non-obvious choice, with the alternative and the reason)?
  - `KNOW-R005` **deleting-loses-something** — would removing this entry lose specific knowledge, or is it redundant with code / another entry?
  - `KNOW-R006` **specific-not-generic** — are the claims concrete and operationally defined, or platitudes (`"the system is scalable"`)?
  - `KNOW-R007` **stranger-in-6-months** — could a stranger pick up this entry 6 months from now without parallel context?
- **3-axis `KnowledgeFinding`** matching the shared craft shape.
- **CLI:** `harness knowledge-craft`.
- **MCP tool:** `knowledge_craft` (count 78 → 79).
- **4-platform skill markdown.**
- **Config block:** `craft.knowledge.{enabled, maxFiles, excludeDirs}`.
- **Cross-cutting API:** `critiqueKnowledgeFile(file, opts)` for callers that have a doc in hand.

### Out-of-scope (v1)

- No ADR critique (spec-craft).
- No AGENTS.md critique (v1.x).
- No graph reads / queries.
- No autofix (`align-knowledge` v2).
- No per-section / per-claim granularity.
- No B' bootstrap.
- No graph persistence of findings.
- No non-markdown formats (asciidoc, rst).

## Inputs

- **Project root path** (CLI / MCP arg).
- **harness.config.json** — `craft.knowledge.{enabled, maxFiles, excludeDirs}`.
- **LLM provider** (MockLlmProvider in v1; same posture as the rest of the craft family).

## Outputs

```ts
interface KnowledgeFinding {
  /** Stable code in KNOW-R\d{3} namespace. */
  code: string;
  phase: 'critique';
  tier: 'foundational' | 'polish' | 'aspirational';
  impact: 'small' | 'medium' | 'large';
  confidence: 'high' | 'medium' | 'low';
  target: {
    file: string;
    /** Relative path from docs/knowledge/ for display (e.g. 'design/component-anatomy.md'). */
    relative: string;
  };
  message: string;
  cite: { rubricId: string; source: string };
  derived: { priority: number };
}

interface KnowledgeCraftOutput {
  findings: KnowledgeFinding[];
  summary: {
    phaseRun: ['critique'];
    mode: 'fast';
    durationMs: number;
    llmCalls: { provider: string; model: string; count: number; costUsd: number };
    catalog: { rubricsApplied: string[] };
    counts: { filesScanned: number; filesSkipped: number };
    runId: string;
  };
}
```

## Technical Design

### Module layout

```
packages/cli/src/knowledge-craft/
  findings/
    schema.ts                      # KnowledgeFinding, KnowledgeCraftOutput
  catalog/
    rubrics/
      load-bearing-fact.ts         # KNOW-R001
      truth-not-derivable.ts       # KNOW-R002
      earns-graph-place.ts         # KNOW-R003
      carries-forward-decision.ts  # KNOW-R004
      deleting-loses-something.ts  # KNOW-R005
      specific-not-generic.ts      # KNOW-R006
      stranger-in-6-months.ts      # KNOW-R007
    index.ts                       # rubric registry
  extract/
    discover.ts                    # walk docs/knowledge/, exclude decisions/
  phases/
    critique.ts                    # LLM critique loop per (file, rubric)
  index.ts                         # runKnowledgeCraft + critiqueKnowledgeFile
packages/cli/src/mcp/tools/
  knowledge-craft.ts
packages/cli/src/commands/
  knowledge-craft.ts
agents/skills/{4 platforms}/knowledge-craft/
  SKILL.md
  skill.yaml
```

### Entry discovery

```ts
const KNOWLEDGE_ROOT = 'docs/knowledge';
const EXCLUDED_DIRS = new Set(['decisions']); // ADRs belong to spec-craft

export function discoverKnowledgeEntries(
  projectRoot: string,
  extraExcludeDirs?: ReadonlyArray<string>
): string[] {
  const root = path.join(projectRoot, KNOWLEDGE_ROOT);
  if (!fs.existsSync(root)) return [];
  const exclude = new Set<string>([...EXCLUDED_DIRS, ...(extraExcludeDirs ?? [])]);
  const out: string[] = [];
  walk(root, out, exclude);
  return out;
}

function walk(dir: string, out: string[], exclude: Set<string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (exclude.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out, exclude);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'readme.md') {
      out.push(path.join(dir, entry.name));
    }
  }
}
```

### Critique phase

Per (file, rubric) pair:

1. Read file content (skip if read fails).
2. Truncate content to 4000 chars (knowledge entries are typically shorter; truncation is a safety net).
3. Build prompt: rubric + file path (relative to docs/knowledge/) + full entry content.
4. LLM returns fenced JSON: `null` (rubric doesn't apply / entry is fine) OR `{ tier, impact, confidence, message }`.
5. On non-null: emit `KnowledgeFinding` with `cite.rubricId` (ADR 0020).

KNOW-R003 (earns-graph-place) is the rubric that names the graph taxonomy in its description:

```
"Does this entry earn a place in the knowledge graph as one of `business_fact`,
`business_rule`, `business_concept`, or `business_decision`? If yes, name which.
If no, the entry is likely scratchpad-quality and belongs in a discussion / RFC."
```

The LLM critiques against the taxonomy without knowledge-craft reading the graph.

### Cross-cutting API

```ts
export async function runKnowledgeCraft(input: KnowledgeCraftInput): Promise<KnowledgeCraftOutput>;
export async function critiqueKnowledgeFile(
  file: string,
  opts?: { source?: string; rubrics?: KnowledgeRubric[]; provider?: LlmProvider }
): Promise<KnowledgeFinding[]>;
```

`critiqueKnowledgeFile` is invocable on any markdown file (not gated to docs/knowledge/); callers responsible for scoping. Future composition with harness-knowledge-pipeline can call this when a fresh entry lands.

## Surface area

### CLI

```
harness knowledge-craft [options]
  --files <files...>             Optional file scope (overrides discovery)
  --exclude-dirs <dirs...>       Additional subdir names to skip (default: just 'decisions')
  --max-files <n>                Cap entry count (default: 50)
  --json
  --verbose / --quiet
```

Exit codes:

- `0` — no foundational-tier findings
- `1` — at least one foundational-tier finding
- `2` — crashed

### MCP tool

`knowledge_craft` — count 78 → 79.

### Config

```ts
craft.knowledge: {
  enabled: boolean;       // default true
  maxFiles: number;       // default 50
  excludeDirs?: string[]; // default: just ['decisions'] (always added; user-supplied extras)
}
```

## Rationalizations to reject

| Rationalization                                                                      | Why it's wrong                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Include ADRs (`decisions/`) for completeness"                                       | Spec-craft owns ADRs; double-critique on the same files produces noisy duplicate findings. v2 can introduce a cross-craft coordination layer; v1 stays clean.                                     |
| "Critique AGENTS.md as a knowledge entry"                                            | AGENTS.md is a navigational manifest, not a fact-bearing entry. Rubrics like 'load-bearing-fact' misfire on a table of contents. v1.x with a dedicated manifest-rubric set if signal warrants.    |
| "Read the graph to check if entry is already a node"                                 | Couples knowledge-craft to harness-knowledge-pipeline at runtime. v1 references graph types in rubrics so the LLM critiques against the taxonomy without the dependency. Cheaper + simpler.       |
| "Use per-section critique like spec-craft"                                           | Knowledge entries are smaller than specs (typically 1-3 sections); per-section adds prompt overhead without much localization gain. Per-file aligns with how authors think about entries.         |
| "Add a `--include-decisions` flag for users who want both spec + knowledge critique" | Forces users to know about cross-skill division. v2's craft-pipeline orchestrator can compose both skills with sensible coordination; v1 stays narrow.                                            |
| "Run all 7 rubrics on every entry regardless of content"                             | All rubrics apply to all knowledge entries (no per-file filter needed — knowledge entries are uniform in shape). The LLM returns `null` when a rubric doesn't apply, which is the runtime filter. |
| "Use a unified CRAFT-K\d{3} code namespace"                                          | Per-skill (KNOW-R\d{3}) keeps debugging local. Convergence to a shared prefix is v2 if it pays off.                                                                                               |

## Success criteria

**Entry discovery (5)**

1. Discovers `.md` files under `docs/knowledge/`
2. EXCLUDES `decisions/` subdir entirely (spec-craft territory)
3. Excludes README.md files (case-insensitive)
4. Honors `--exclude-dirs` for additional subdir skips
5. Returns [] when `docs/knowledge/` doesn't exist

**Catalog + critique (10)**

6. 7 seed rubrics ship at `catalog/rubrics/<id>.ts` (file-per-rubric)
7. `runKnowledgeCraft({ path })` walks entries + emits KnowledgeCraftOutput
8. Mock LLM provider's deterministic response produces a valid KnowledgeFinding
9. Each finding includes `cite.rubricId` (ADR 0020)
10. 3-axis preserved (ADR 0019)
11. `derived.priority` computed via shared/craft
12. Per-file `target.relative` is computed from docs/knowledge/ as root
13. LLM `null` response does NOT emit a finding
14. Cost telemetry populated
15. Per-project `maxFiles` cap honored

**Graph-taxonomy reference (2)**

16. KNOW-R003 description explicitly names `business_fact`, `business_rule`, `business_concept`, `business_decision`
17. No imports from `@harness-engineering/graph` (no runtime graph dependency)

**Cross-cutting (2)**

18. `critiqueKnowledgeFile(file, opts)` exported and invocable on any markdown
19. Accepts custom rubric set + provider override

**Surface area (5)**

20. New MCP tool `knowledge_craft` registered (count 78 → 79)
21. New CLI command `harness knowledge-craft`
22. 4-platform skill markdown
23. New config block `craft.knowledge.*` validates
24. Auto-doc regenerates with `knowledge_craft` + `knowledge-craft` skill entries

**Plugins (1)**

25. Plugin slash-commands pre-generated (`.claude-plugin` + `.cursor-plugin`)

## Long-term trajectory

- **v1.x — AGENTS.md critique** with dedicated manifest rubrics (orientation quality, TOC completeness, link freshness).
- **v1.x — per-section / per-claim modes** as opt-in for very large knowledge entries.
- **v1.x — `align-knowledge` sibling FIX skill** for safe-to-apply rewrites (load-bearing-fact extraction from prose, redundancy collapse).
- **v1.x — graph-aware mode** as opt-in: critique against actual ingested nodes ("this entry duplicates business_fact:user-roles ingested at 2026-04-12").
- **v2 — composes with harness-knowledge-pipeline** at ingest time: when a new entry is added to the graph, run knowledge-craft critique inline.
- **v3 — cross-entry consistency rubrics** ("this entry contradicts another entry's claim"; "this entry's wording suggests a fact that another entry contradicts").

## Risks + mitigations

| Risk                                                                            | Mitigation                                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Knowledge entries vary widely in shape (some are facts, some are essays)        | LLM returns `null` when a rubric doesn't apply; per-rubric filtering happens at the LLM layer, not in static config.                                                                               |
| LLM cost balloons on a large knowledge base                                     | Per-project cap (default 50 files) + per-file content truncation (4000 chars). Cost reported in `summary.llmCalls.costUsd`.                                                                        |
| Entries that are intentionally scratchpad / in-progress get flagged             | Low-confidence findings de-emphasized per ADR 0019. v1.x adds `<!-- knowledge-craft:skip -->` frontmatter annotation.                                                                              |
| False positives on entries that paraphrase code intentionally (e.g., tutorials) | Per-rubric `null` response handles this when the LLM judges the rubric inapplicable. Tutorials might still get tagged for KNOW-R001 (load-bearing-fact); low confidence flag is the v1 mitigation. |
| Overlap with spec-craft if user runs both on the same project                   | `decisions/` is the canonical line. The exclusion logic prevents double-critique. Other subdirs are knowledge-craft-only.                                                                          |
| `business_decision` as a graph type doesn't exist yet                           | Doesn't matter — the rubric description names it aspirationally; the LLM uses it as part of the taxonomy framing. Adding `business_decision` as a graph type is a v2 concern.                      |

## Open questions deferred to implementation

- **Content truncation length.** v1 ships 4000 chars (knowledge entries are typically shorter than specs).
- **Whether to walk one level deep under `docs/knowledge/`.** v1 walks recursively to all depths (subdirs like `decisions/`, `design/`, `business-knowledge/` are honored). Configurable in v1.x if needed.
- **Handling of `.mdx` files.** v1 only globs `.md`. `.mdx` (markdown with components) deferred — different parsing concerns.
  EOF
