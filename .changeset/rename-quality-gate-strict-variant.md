---
'@harness-engineering/cli': minor
---

Rename the `quality-gate` hook to `quality-warner` and add a blocking `strict-quality-gate` variant.

The standard-profile hook formerly named `quality-gate` never blocked (it warns on
stderr and always exits 0), so the name implied enforcement it did not provide. It is
now `quality-warner`, matching its behavior. A new strict-profile hook,
`strict-quality-gate`, **exits 2 on genuine format/lint violations** (surfacing them to
the agent as a must-fix) and fails open — warning and exiting 0 — when the formatter is
absent, times out, or its output is unparseable. Both hooks share detection through a new
support module, `format-check.js`, which the installer ships alongside whichever quality
hook is active.

**Action required:** re-run `harness hooks init` (or update via plugin) to replace the
old `quality-gate.js` with `quality-warner.js` + `format-check.js`. There is no
back-compat alias; the installer self-heals on re-init.
