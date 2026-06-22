# Outcome Eval

> Post-execution LLM-judgment: did the implementation actually satisfy its spec? Reads the spec's acceptance section, the change diff, and test output, and emits a confidence-rated `OutcomeVerdict` (`SATISFIED | NOT_SATISFIED | INCONCLUSIVE`) with a rationale and unmet criteria. Ship authority is derived in TypeScript, never trusted from the LLM: a high-confidence `NOT_SATISFIED` blocks ship; every other verdict is advisory. The harness's first blocking post-execution spec-satisfaction gate (the roadmap's named #1 gap). Each verdict persists as an `execution_outcome` node, compounding into skill-effectiveness baselines.

## When to Use

- At orchestrator step 6.5 — after Code Review, before Ship — on every change with a spec.
- When you need a durable, structured answer to "did this code do what the spec said?"
- NOT for pre-execution risk simulation (use PESL).
- NOT for rule-based floors (lint/architecture/entropy) or craft ceilings (naming/spec/security) — those run elsewhere.
- NOT for auto-remediation. outcome-eval judges; it does not fix.
- NOT when no judgable spec section exists — the verdict degrades to INCONCLUSIVE/advisory and never blocks.
