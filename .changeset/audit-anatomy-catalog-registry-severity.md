---
'@harness-engineering/cli': minor
---

audit-component-anatomy: add public `getCatalogTypes()` export and full `design.strictness` × severity matrix.

This closes the contract gap between `harness-accessibility` Phase 1 step 2.6 (which references `getCatalogTypes()` from `audit-component-anatomy`'s public export) and the audit module (which previously had no such export). A new catalog registry (`catalog/index.ts`) becomes the single source of truth for component types and conventions — replacing the inline single-entry maps that lived in two resolvers. The `findings/severity.ts` matrix wires `design.strictness` (strict / standard / permissive) through `runAudit` and the convention runner so emitted finding severities match the spec's documented table. Adds 23 new unit + integration tests covering the registry contract, severity matrix, and end-to-end strictness threading.
