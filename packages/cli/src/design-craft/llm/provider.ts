// packages/cli/src/design-craft/llm/provider.ts
//
// The LlmProvider interface + MockLlmProvider + getProvider moved to
// packages/cli/src/shared/craft/llm/provider.ts on the
// 2nd-non-design-craft-consumer trigger (spec-craft). This file remains
// as a re-export shim so historical import paths keep working.
//
// See: docs/changes/craft-pipeline/spec-craft/proposal.md
//      (Technical Design → Shared/craft extraction).

export {
  type LlmProvider,
  type LlmCallCost,
  type VisionInput,
  MockLlmProvider,
  getProvider,
} from '../../shared/craft/llm/provider.js';
