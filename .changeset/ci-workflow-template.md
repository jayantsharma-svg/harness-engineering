---
'@harness-engineering/cli': minor
---

Ship a complete CI workflow on `harness init`. Projects now inherit
`.github/workflows/ci.yml` automatically — a single fail-fast GitHub Actions job
that builds, lints, and tests (language-appropriate for TypeScript, Python, Go,
Rust, and Java) and runs the consolidated `harness ci check` gate on every pull
request and push to `main`. The workflow is written for both new and existing
projects and never overwrites an existing workflow file.

`harness ci init` and `harness init` now route through a single CI generator
(ADR 0037), so the two paths cannot drift; the enriched GitHub output replaces the
gate-only `harness.yml` with `ci.yml`. The generated workflow installs the harness
CLI before the gate and deliberately contains no auto-baseline-update / `git push`
step (roadmap #525). `harness ci init` also gains a `--language` option.
