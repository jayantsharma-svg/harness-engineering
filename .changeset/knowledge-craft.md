---
'@harness-engineering/cli': minor
---

Add **knowledge-craft** — ninth sub-project of the craft-pipeline initiative (#9 of 10; fifth non-design). LLM-judgment skill for knowledge-entry quality under `docs/knowledge/`. Critiques whether an entry states a load-bearing FACT (not paraphrase of code), earns a place in the knowledge graph taxonomy, carries forward a decision that would otherwise erode, or could be picked up by a stranger six months from now. The ceiling counterpart to `harness-knowledge-pipeline` (procedural ingestion) and `harness-detect-doc-drift` (structural).

**Three decisions locked:**

1. **v1 scope: `docs/knowledge/` EXCLUDING `decisions/`.** Hard exclusion of the `decisions/` subdir avoids double-critique with spec-craft (which owns ADRs). AGENTS.md deferred to v1.x (different shape: navigational manifest vs fact-bearing entry).
2. **Per-file granularity.** Knowledge entries are typically focused single-topic docs (1-3 sections); per-file aligns with how knowledge authors think. Per-section adds prompt overhead without localization gain at this scale; per-claim is too noisy + expensive.
3. **Reference graph types in rubrics, no graph reads at runtime.** `KNOW-R003` (earns-graph-place) names `business_fact` / `business_rule` / `business_concept` / `business_decision` in its rubric description so the LLM critiques against the taxonomy; knowledge-craft never imports from `@harness-engineering/graph`. Avoids coupling to harness-knowledge-pipeline while keeping the rubric semantically aware.

**7 seed rubrics** (one file per rubric, matches naming-craft / spec-craft / copy-craft layout):

| Rubric      | Title                                               |
| ----------- | --------------------------------------------------- |
| `KNOW-R001` | States a load-bearing fact (not paraphrase)         |
| `KNOW-R002` | Truth a code reader could not derive                |
| `KNOW-R003` | Earns a place in the knowledge graph taxonomy       |
| `KNOW-R004` | Carries forward a decision that would erode         |
| `KNOW-R005` | Deleting would lose specific knowledge              |
| `KNOW-R006` | Concrete and operationally defined (not platitudes) |
| `KNOW-R007` | A stranger could pick it up six months from now     |

**Honors ADRs 0018-0021:** confidence first-class, 3-axis preserved (tier × impact × confidence), `cite.rubricId` on every finding for catalog usage signal, living-catalog H seed format (`contribution` / `signal` / `version` fields reserved).

**Cross-cutting API:** `critiqueKnowledgeFile(file, opts)` exported. Future composition target — `harness-knowledge-pipeline` can call this when a fresh entry lands at ingest time (v2). Mirrors the same shape as `critiqueSpecFile` / `critiqueCopyInFile` / `critiqueNameFile`.

**Surface area:**

- `harness knowledge-craft` CLI command (`--files` / `--exclude-dirs` / `--max-files` / `--json`)
- `knowledge_craft` MCP tool (count 78 → 79)
- 4-platform skill markdown (claude-code / codex / cursor / gemini-cli)
- Plugin slash-commands generated for `.claude-plugin/` + `.cursor-plugin/`

**Tests:** 22 new tests (8 discover + 5 critique + 9 integration) covering: hard-exclusion of `decisions/`, graph-taxonomy-naming contract for KNOW-R003 (no graph imports at runtime), per-file critique with mock LLM, cross-cutting `critiqueKnowledgeFile`, files override, maxFiles cap, excludeDirs honoring, README exclusion (case-insensitive), POSIX path normalization. 109 sibling craft tests (naming/spec/copy/design) still pass after the new module imports `shared/craft`.

**Long-term trajectory:**

- v1.x: AGENTS.md critique with dedicated manifest rubrics; per-section / per-claim opt-in for very large entries; `align-knowledge` sibling FIX skill for safe rewrites (load-bearing-fact extraction, redundancy collapse); graph-aware mode (opt-in: critique against actual ingested nodes).
- v2: composes with `harness-knowledge-pipeline` at ingest time — fresh entries run knowledge-craft critique inline.
- v3: cross-entry consistency rubrics ("this entry contradicts another entry's claim").
