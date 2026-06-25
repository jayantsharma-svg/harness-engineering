---
'@harness-engineering/orchestrator': patch
'@harness-engineering/types': patch
---

fix(orchestrator): seed brainstorm handoff artifacts into fresh worktrees

New worktrees are checked out from a committed remote ref (e.g. `origin/main`),
so they did not inherit the uncommitted artifacts of the brainstorm →
orchestrator handoff — the proposal under `.harness/proposals/` and the promoted
row in `docs/roadmap.md`. A dispatched agent saw the roadmap entry (the tracker
reads the live working tree) but could not find its proposal and stalled.

`WorkspaceManager.ensureWorkspace` now seeds those paths from the root working
tree into each fresh worktree (best-effort: missing sources skipped, copy
failures swallowed). Seed paths default to `['.harness/proposals',
'docs/roadmap.md']`, are overridable via the new `WorkspaceConfig.seedPaths`,
and the orchestrator derives the roadmap entry from the configured tracker
`filePath` so a non-default roadmap location is still carried over.
