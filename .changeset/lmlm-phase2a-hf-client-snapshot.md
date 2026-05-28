---
'@harness-engineering/local-models': minor
---

Adds Phase 2a of the Local Model Lifecycle Manager — the HuggingFace data plane and the frozen benchmark snapshot.

- `HuggingFaceClient` is a typed wrapper over the public HF REST endpoints (`/api/models`, `/api/models/:repo`). Every failure mode maps to a stable `HuggingFaceClientError` code (`HF_NOT_FOUND`, `HF_UNAUTHORIZED`, `HF_UNAVAILABLE`, `HF_NETWORK`, `HF_PARSE`) so the cache and the future ranker can branch deterministically.
- `HuggingFaceCache` is a versioned in-memory + on-disk cache for HF responses. The on-disk file at `~/.harness/local-models/cache/huggingface.json` is written atomically via tmp + rename (mirrors the proposal's O2 invariant). Missing, malformed, or schema-mismatched files reset to an empty cache and emit a structured warning instead of throwing.
- `loadFrozenSnapshot` returns the bundled benchmark snapshot the orchestrator falls back to when HF and the live leaderboard sources are unreachable (S4). The loader is intentionally lenient — malformed or schema-invalid input yields a typed warning and an empty snapshot, never a throw.
- A seed `snapshot.json` ships three placeholder models across Qwen / DeepSeek / Llama so Phase 2c has something to merge against on its first run.
- The HF `fetcher` and the cache filesystem are injected through narrow interfaces — unit tests stay fully deterministic without touching the network or the real `~/.harness` directory.

No orchestrator, CLI, dashboard, or HTTP wiring yet. VRAM/speed math (Phase 2b), evidence + recency grading (Phase 2c), the merge algorithm (Phase 2c), the `RankedModel` orchestrator (Phase 2d), and the parity tests against the whichllm reference outputs (Phase 2d) land in subsequent slices. LMLM remains opt-in and disabled by default per Phase 0.
