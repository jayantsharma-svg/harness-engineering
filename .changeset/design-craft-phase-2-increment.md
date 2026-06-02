---
'@harness-engineering/cli': minor
---

design-craft Phase 2 increment: extend the seed catalog (3 critique rubrics: hierarchy-clarity, typography-craft, motion-quality; 1 polish pattern: spring-physics; 1 exemplar: linear-empty-list) and wire all three phases (CRITIQUE / POLISH / BENCHMARK) through the `mcp__harness__design_craft` MCP tool. POLISH applies LLM judgment against polish patterns with a lightweight applicability pre-filter to keep fast-mode cheap. BENCHMARK computes 5-dim radar scores with overall = mean(score) + min(confidence) per the locked aggregation rule. Output now reports `summary.catalog.patternsApplied` and `summary.catalog.exemplarsCited`.
