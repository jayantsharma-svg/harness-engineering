---
'@harness-engineering/cli': patch
'@harness-engineering/orchestrator': patch
---

Harden `harness update` against empty `npm view` responses and migrate to the renamed `@earendil-works/pi-coding-agent` SDK.

- `getLatestVersionAsync` now rejects when `npm view <pkg> dist-tags.latest`
  returns empty stdout. Previously a transient registry hiccup rendered as
  `cli: v2.4.5 → v` in the update banner; now the package is silently
  skipped by the caller's `Promise.allSettled`.
- `@mariozechner/pi-coding-agent@^0.73.1` → `@earendil-works/pi-coding-agent@^0.74.1`
  (the maintainer renamed the package family). Eliminates 4 of 6 npm
  deprecation warnings during `harness update`. The 2 remaining
  (`prebuild-install`, `node-domexception`) are transitives through
  `better-sqlite3` and `@google/genai` respectively — out of our control
  until upstream bumps.

No behavior change beyond the deprecation cleanup.
