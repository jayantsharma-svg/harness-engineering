// packages/cli/src/design-craft/catalog/patterns/spring-physics.ts
//
// First Phase 2 catalog pattern — ported from the Phase 0 paper spike:
//   docs/changes/design-pipeline/design-craft-elevator/phase-0-schema-spike/
//   patterns/spring-physics-microinteraction.md
//
// CRAFT-P001 — the first polish pattern in the design-craft namespace.
// Establishes the `PatternDefinition` shape that the rest of the 15-pattern
// seed catalog will conform to. Schema mirrors the YAML form in the spec
// section "Catalog entry formats" (lines ~233–259) with one adjustment:
//   - `kind` strings on `applicableTo[]` are intentionally NOT enumerated
//     in the type (Phase 0 review observation: future kinds must be allowed
//     without a schema bump).
//
// Honors ADR 0020 (living catalog H pattern): id/version/status/authoredAt/
// contributors/source are required so growth signal + provenance work.

import type { Tier, Impact, FindingPhase } from '../../findings/schema.js';
import type {
  CatalogStatus,
  CatalogSource,
  FindingTemplate,
} from '../rubrics/hierarchy-clarity.js';

/**
 * Where the pattern applies. Discriminator + match string keeps the
 * pattern declarative — the POLISH phase decides how to match.
 *
 * The `kind` field is intentionally typed as `string` (not a literal
 * union) so new kinds can be introduced without a schema bump. Phase 0
 * review observation O7 made this call explicitly.
 */
export interface PatternApplicability {
  /** Discriminator — e.g. 'jsx-attribute', 'css-property', 'identifier'. */
  kind: string;
  /** Substring or regex-as-string the POLISH phase matches against. */
  match: string;
}

/**
 * A polish pattern — the LLM-judgment prompt + provenance + before/after
 * sketch for one craft-elevation move.
 *
 * Like rubrics, patterns are LLM-driven (not codemod): the POLISH phase
 * formats the prompt with target source + before/after sketches, asks the
 * LLM whether the pattern applies, and emits a CraftFinding for each
 * positive match.
 */
export interface PatternDefinition {
  id: string;
  name: string;
  version: number;
  status: CatalogStatus;
  authoredAt: string;
  contributors: string[];
  source: CatalogSource;
  /** Where this pattern applies — used by POLISH for lightweight pre-filtering. */
  applicableTo: PatternApplicability[];
  /** Plain-English description of the condition the pattern addresses. */
  when: string;
  /** Plain-English description of the suggested craft move. */
  suggest: string;
  /** Concrete code sketch of the BEFORE state (low-craft). */
  before: string;
  /** Concrete code sketch of the AFTER state (high-craft). */
  after: string;
  findingTemplate: FindingTemplate;
}

/**
 * Pattern: Spring Physics Micro-interaction.
 *
 * Ported verbatim (content) from the Phase 0 paper pattern. CRAFT-P001 is
 * the first polish code in the design-craft namespace.
 *
 * Note: tier=`polish`, impact=`medium`. Motion is rarely a foundational
 * defect; it's a craft elevator. The LLM may override impact on a per-
 * target basis but the rubric defaults steer towards polish.
 */
export const springPhysicsPattern: PatternDefinition = {
  id: 'pattern-spring-physics',
  name: 'Spring Physics Micro-interaction',
  version: 1,
  status: 'stable',
  authoredAt: '2026-05-23',
  contributors: ['@chadjw'],
  source: {
    ref: 'emil-design-eng#spring-physics',
    url: 'https://github.com/emilkowalski/skill/blob/main/skills/emil-design-eng/SKILL.md',
  },
  applicableTo: [
    { kind: 'jsx-attribute', match: 'transition' },
    { kind: 'css-property', match: 'transition-timing-function' },
    { kind: 'jsx-attribute', match: 'animate' },
  ],
  when: [
    'Element transitions currently use cubic-bezier easing or any of the',
    'CSS keyword timings (ease, ease-in, ease-out, ease-in-out, linear).',
    'This produces motion that feels mechanical and ignores the inertia',
    'cues real materials give the eye.',
  ].join('\n'),
  suggest: [
    'Replace with spring physics. Recommended starting tuning:',
    '  - Primary interactions: stiffness:200 damping:25',
    '  - Secondary interactions: stiffness:300 damping:30',
    '  - Entrances: stiffness:170 damping:26',
    'Use motion library (framer-motion, react-spring, or @react-spring/web)',
    'or a CSS spring polyfill. Always pair with `prefers-reduced-motion`',
    'fallback to a cross-fade or instantaneous state change.',
  ].join('\n'),
  before: 'transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);',
  after: [
    '// Using framer-motion',
    '<motion.div',
    '  animate={{ scale: hovered ? 1.05 : 1 }}',
    "  transition={{ type: 'spring', stiffness: 200, damping: 25 }}",
    '/>',
  ].join('\n'),
  findingTemplate: {
    code: 'CRAFT-P001',
    tier: 'polish',
    impact: 'medium',
    phase: 'polish',
  },
};

/** Re-exports of the supporting types so callers can import from this file. */
export type {
  CatalogStatus,
  CatalogSource,
  FindingTemplate,
} from '../rubrics/hierarchy-clarity.js';
export type { Tier, Impact, FindingPhase };
