---
number: 0044
title: Installer ships hook support files
date: 2026-06-25
status: accepted
tier: medium
source: docs/changes/quality-warner-strict-gate/proposal.md
---

## Context

Hook scripts are copied **raw** (not bundled) from `packages/cli/src/hooks/` into an
adopter's `.harness/hooks/` directory by `harness hooks init`. Until now the installer's
copy contract was strictly one file per named hook: it copied exactly the `.js` files
whose basenames appear in `HOOK_SCRIPTS` for the active profile, and it wiped every other
`.js` in the destination first (to handle profile downgrades).

The `quality-warner` / `strict-quality-gate` work needed both hooks to share a single
detection core (`format-check.js`) so warn-tier and gate-tier behavior cannot drift. The
shared core is a real module that each entrypoint resolves at runtime via a sibling
`import './format-check.js'`. That module is **not** a named hook — it is never registered
in a profile and never appears in `.claude/settings.json` — so the previous installer
would never copy it, and its stale-`.js` wipe would delete it if it were copied some other
way.

## Decision

The installer's copy contract is extended: named hooks **plus** the shared support modules
those hooks depend on. The dependency is declared in a single registry,
`packages/cli/src/hooks/support-files.ts` (`HOOK_SUPPORT_FILES`), keyed by hook name →
support file basenames. Both `hooks init` and `hooks add` consult it: after copying the
active named hooks, they copy the deduplicated set of support files those hooks require.

Support files are re-copied on every install rather than exempted from the stale-`.js`
wipe. The observable contract is identical (the support file is present after any install
that includes a dependent hook) and it keeps downgrades clean: dropping the last dependent
hook also drops its now-orphaned support module, with no special-case exemption logic.

## Consequences

**Positive:**

- Shared logic across hooks is now a supported, shippable pattern — future hook authors
  can factor common code into a sibling module and declare it in `HOOK_SUPPORT_FILES`
  instead of duplicating it across self-contained scripts.
- Single source of truth for formatter detection; warn and strict behavior cannot diverge.

**Negative / risks:**

- Sibling `import` resolution depends on the adopter's `.harness/hooks/` directory being
  treated as ESM (inherited from the nearest `package.json`). The pre-existing hooks
  already use top-level `import`, so this adds no new requirement, but it remains an
  assumption. An integration test executes a copied hook from a temp `.harness/hooks/` to
  prove the relative import resolves.
- Two installer paths (`init`, `add`) must both honor the registry; both are covered by
  tests.
