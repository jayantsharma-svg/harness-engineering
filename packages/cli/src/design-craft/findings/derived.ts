// packages/cli/src/design-craft/findings/derived.ts
//
// The 3-axis derivation logic moved to
// packages/cli/src/shared/craft/findings/derived.ts on the
// 2nd-non-design-craft-consumer trigger (spec-craft). This file remains as
// a re-export shim so historical import paths keep working.
//
// See: docs/changes/craft-pipeline/spec-craft/proposal.md
//      (Technical Design → Shared/craft extraction).

export { derivePriority } from '../../shared/craft/findings/derived.js';
