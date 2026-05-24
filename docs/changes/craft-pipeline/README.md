# Craft Pipeline Initiative

> Cross-domain LLM-judgment ceiling pipeline. Each sub-project is a domain-specific ceiling-raiser to a rule-based floor counterpart. Mirrors `harness:docs-pipeline` and `harness:design-pipeline` — but the orchestrated work is craft elevation across every domain in the codebase, not just one.

## Why this exists

Rule-based skills are floors. They check existence, completeness, structural validity, link freshness, layer boundaries. They make codebases CONSISTENT — and consistent is necessary but not sufficient. Consistent is a floor. The ceiling — does this name carry weight, does this test add signal, does this error tell the user what to do, is this spec sharp — is judgment-bound, not pattern-matchable.

The pattern was established by `design-craft-elevator` (design-pipeline sub-project #6, the prototype) and codified in four ADRs:

- **[ADR 0018](../../knowledge/decisions/0018-llm-judgment-skill-pattern.md)** — LLM-judgment skill pattern (confidence-as-first-class, deterministic-vs-judgment separation, vision-vs-text mode selection)
- **[ADR 0019](../../knowledge/decisions/0019-3-axis-craft-output-model.md)** — 3-axis output model (tier × impact × confidence) + 5-dim radar for holistic scoring
- **[ADR 0020](../../knowledge/decisions/0020-living-catalog-h-pattern.md)** — Living catalog with growth infrastructure (seed + contribution + signal + measurement)
- **[ADR 0021](../../knowledge/decisions/0021-detect-and-offer-b-prime-pattern.md)** — Detect-and-offer (B') soft-dependency-with-progressive-upgrade pattern

This initiative applies that pattern across the rest of the codebase's craft surface.

## Sub-projects

| #   | Skill             | Rule-based floor counterpart                   | Ceiling question                                                                |
| --- | ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | `naming-craft`    | (none — pure ceiling)                          | Does this name carry weight? Match codebase's naming gravity?                   |
| 2   | `docs-craft`      | harness-detect-doc-drift, harness-check-docs   | Does this doc teach? Are examples earning their place?                          |
| 3   | `test-craft`      | harness-tdd, coverage thresholds               | Does this test add signal? What would deleting it lose?                         |
| 4   | `code-craft`      | harness-entropy-cleaner, complexity thresholds | Is this as simple as it could be? Is this abstraction earned?                   |
| 5   | `copy-craft`      | (none — pure ceiling)                          | Errors: WHAT/WHY/HOW-TO-FIX? Logs: signal or noise? Commits: stranger-readable? |
| 6   | `spec-craft`      | harness-soundness-review (structure)           | Is this spec sharp? Would two readers walk away with the same understanding?    |
| 7   | `api-craft`       | harness-api-openapi-design (knowledge)         | Verb honest? Response shape predictable?                                        |
| 8   | `cli-ergonomics`  | (none — pure ceiling)                          | Does the CLI discover itself? Output respect the terminal?                      |
| 9   | `knowledge-craft` | harness-knowledge-pipeline (procedural)        | Is this entry a load-bearing fact or paraphrase?                                |
| 10  | `security-craft`  | harness-security-scan (CVE/OWASP)              | Trust boundary respected? Threat modeling as skill, not pattern matching.       |

Plus `design-craft-elevator` (lives in design-pipeline initiative for cohesion with the rest of the design family; participates in this pipeline by composition).

## Architecture (all sub-projects share)

- **LLM provider integration** via `packages/intelligence/` — wrapped by each craft skill's `llm/provider.ts`
- **MCP tool surface** — each sub-project ships `mcp__harness__{name}_craft` (or similar) for programmatic invocation
- **3-axis findings** — tier (foundational / polish / aspirational) × impact (small / medium / large) × confidence (high / medium / low). Derived `priority` field for single-axis sorting.
- **5-dim radar** — for BENCHMARK-style scoring against exemplars (philosophicalCoherence, hierarchy, craftExecution, function, innovation — though dimensions can vary per domain)
- **Growth infrastructure** — seed catalog + contribution format + signal feedback loop + usage measurement (the H pattern)
- **B' detect-and-offer** — soft dependency with progressive upgrade for prereqs (e.g., docs-craft offers to capture doc style guide if missing)
- **Graph integration** — `VIOLATES_CRAFT` edges via extended `DesignConstraintAdapter`; per-domain `CRAFT_SCORE` nodes

## Recommended build order

1. **naming-craft (#1)** — cross-cutting, no floor counterpart, smallest scope (~1 week). Embedded in others later.
2. **docs-craft (#2)** — direct structural twin to design-craft-elevator. Proves the pattern transfers cleanly to a new domain.
3. **spec-craft (#6)** — highest-leverage (spec quality compounds across the lifecycle). Touches harness's own most-frequent artifact type.
4. **test-craft (#3)** + **code-craft (#4)** — paired; review-time PR companions.
5. **copy-craft (#5)** — small, high UX-impact. Errors first.
6. **api-craft (#7)** + **cli-ergonomics (#8)** + **knowledge-craft (#9)** — domain-specific, parallel.
7. **security-craft (#10)** — last. Defer until 2-3 craft skills are proven; judgment-based security is the hardest to land well.

## Orchestrator design

The `harness:craft-pipeline orchestrator` (parent #316-equivalent) composes the sub-projects in phases mirroring `harness:docs-pipeline` and `harness:design-pipeline`:

- **FRESHEN** — verify each craft skill's catalog is current
- **JUDGE** — invoke each craft skill's CRITIQUE phase
- **SUGGEST** — invoke each skill's POLISH phase (where applicable)
- **BENCHMARK** — compare against per-domain exemplars
- **REPORT** — aggregate findings across all craft skills, deduplicate cross-skill overlap

The orchestrator is the last sub-project to build, after #1-#10 ship their MCP tools.

## What this initiative is NOT

- Not a code generator (use Anthropic Claude / Cursor / v0 / bolt directly for generation)
- Not a replacement for any rule-based skill (each ceiling skill ASSUMES its floor counterpart exists and defers to it)
- Not autofix tooling (POLISH suggestions are codemod-TODOs, not applied edits)
- Not real-time IDE feedback (skills are invocation-triggered, not always-on)
- Not a single monolithic critic — each craft skill has a focused domain-specific catalog of rubrics, patterns, exemplars

## Status

**Just filed (2026-05-24).** All 10 sub-projects + orchestrator entered in roadmap as `planned`. No specs yet — each sub-project enters `harness:brainstorming` when picked up.

design-craft-elevator (prototype) is in `design-pipeline sub-project #6` and has reached Phase 1 vertical slice (see `docs/changes/design-pipeline/design-craft-elevator/`). Its ADRs (0018-0021) document the patterns this entire family inherits.
