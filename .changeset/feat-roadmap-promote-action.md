---
'@harness-engineering/core': minor
'@harness-engineering/cli': minor
---

Add `manage_roadmap` action `promote` and the `promoteFeature` core function for the brainstorm-driven roadmap loop (sub-project 1 of 4).

`promoteFeature` (exported from `@harness-engineering/core`) is a pure, IO-free state-transition over `(Roadmap, { feature, spec, summary? }) → { result, nextRoadmap }`. It advances an existing backlog row to `planned` and links its spec in place — instead of appending a duplicate `planned` row — applying a state-conditional rule set: `backlog → planned`; `planned`/`blocked`/`needs-human` update the spec link while preserving status; `in-progress` and `done` refuse; lookup misses return `not-found` with Levenshtein-ranked `closestMatches`; same-name rows across milestones return `ambiguous` with milestone-qualified matches. A non-`backlog` row already linked to the same spec is an idempotent `noop`. A human-authored summary and the `Plan`/`Assignee`/`Priority`/`External-ID`/`Blockers`/`Milestone` fields are never overwritten.

The `manage_roadmap` MCP tool (`@harness-engineering/cli`) gains `action: 'promote'` (inputs `feature`, `spec`, optional `summary`), wired in both file-backed and file-less modes, returning the structured `RoadmapPromoteResult` envelope. `harness-brainstorming` Phase 4 now calls `promote` instead of `add` and commits `proposal.md`, `SKILLS.md`, and `roadmap.md` together so the promotion is atomic with the spec. See ADRs 0042 (structured envelopes) and 0043 (rules-in-core).
