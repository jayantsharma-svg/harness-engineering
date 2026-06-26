---
'@harness-engineering/orchestrator': patch
---

fix(orchestrator): batch open-PR checks to avoid exhausting GitHub's API rate limit

`filterCandidatesWithOpenPRs` issued one `gh pr list --search "closes #N"` query
per candidate on every tick. Every `gh pr list` form is served by GitHub's GraphQL
API and draws from the shared ~5000/hr budget, so the per-issue fan-out exhausted
the limit on busy boards. Once exhausted, every check threw, the fail-open path
passed all candidates through, and PR-guarded issues were redispatched (duplicate
work).

Checks are now batched: one `gh pr list --repo X --state open --json body` call
per distinct repo (via `fetchOpenPRClosures`), with closing-issue references parsed
locally — collapsing N requests/tick into one per repo. Identifier-only candidates
keep the per-candidate `--head` lookup; non-GitHub externalId candidates now
correctly fall back to branch lookup instead of always passing through. Fail-open
behavior is preserved.
