---
'@harness-engineering/local-models': patch
'@harness-engineering/types': minor
'@harness-engineering/cli': minor
---

Scaffolds the Local Model Lifecycle Manager (LMLM) — Phase 0.

- New package `@harness-engineering/local-models` (empty barrel, no business logic yet).
- New types in `@harness-engineering/types`: `LocalModelsConfig`, `LocalModelsPoolConfig`, `LocalModelsRefreshConfig`, `LocalModelsInstallerConfig`, `LocalModelsHardwareOverride`, plus platform/installer unions.
- New optional `localModels` block on `HarnessConfigSchema` in the CLI, with Zod defaults that match the spec (24h refresh, 100GB budget, Ollama installer, opt-in disabled by default).

Disabled by default; `harness validate` on existing configs remains green. Hardware detection, ranking, pool management, installer, proposal lifecycle, scheduler, HTTP/WS surfaces, CLI commands, and dashboard panel land in subsequent phases per `docs/changes/local-model-lifecycle-manager/proposal.md`.
