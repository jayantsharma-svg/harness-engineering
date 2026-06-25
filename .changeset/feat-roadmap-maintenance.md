---
'@harness-engineering/core': minor
'@harness-engineering/cli': minor
---

Add roadmap maintenance: health checks, grooming, an `Intake` lane, and a split archive.

Encodes one principle in code — **a milestone is a theme, a status is a lifecycle stage** — so the roadmap stays tidy over time instead of decaying into an undifferentiated backlog dump.

- **`@harness-engineering/core`** gains `packages/core/src/roadmap/health.ts`: `checkRoadmapHealth` (read-only diagnostics — RMH001 done-outside-archive, RMH002 unactionable `planned` rows with no spec & no plan, RMH003 lifecycle catch-all milestones `[error]`, RMH004 oversized active milestones) and `groomRoadmap` (pure transform: demote unactionable `planned` to `backlog`, lift `done` features out for archival). The not-found create path in `promoteFeature` now lands new rows in an **`Intake`** lane instead of recreating a `Current Work` catch-all.
- **`@harness-engineering/cli`** wires `checkRoadmapHealth` into `harness validate` as a `roadmapHealth` check (RMH003 fails validation; others are warnings), and adds a `groom` action to the `manage_roadmap` MCP tool that demotes unactionable `planned` rows and moves completed features into `docs/roadmap-archive.md` under a `Shipped` milestone, keeping the orchestrator's parsed `docs/roadmap.md` lean.
- The `harness-roadmap` skill documents a `--groom` mode.
- The `initialize-harness-project` skill now seeds the deferred "Set up design system" entry under the `Intake` lane instead of a `Current Work` catch-all, so freshly-initialized projects start tidy and pass the `roadmapHealth` guard.
