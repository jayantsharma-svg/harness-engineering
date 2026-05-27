// packages/cli/src/design-craft/catalog/rubrics/motion-quality.ts
//
// Third Phase 2 catalog rubric — ported from the Phase 0 paper spike:
//   docs/changes/design-pipeline/design-craft-elevator/phase-0-schema-spike/
//   rubrics/motion-quality.md
//
// CRAFT-C003 — covers the motion dimension. Pairs with the polish-phase
// pattern `pattern-spring-physics` (CRAFT-P001): the rubric identifies
// motion craft problems, the pattern offers the high-craft fix.
//
// Note: this rubric explicitly flags code-only mode as a low-confidence
// surface. The CRITIQUE phase preserves the LLM-emitted confidence
// verbatim (ADR 0019) so the operator sees the honest signal.

import type { RubricDefinition } from './hierarchy-clarity.js';

export const motionQualityRubric: RubricDefinition = {
  id: 'rubric-motion-quality',
  name: 'Motion Quality',
  version: 1,
  status: 'stable',
  authoredAt: '2026-05-23',
  contributors: ['@chadjw'],
  appliesTo: ['component'],
  source: {
    ref: 'emil-design-eng#animation-decision-framework',
    url: 'https://github.com/emilkowalski/skill/blob/main/skills/emil-design-eng/SKILL.md',
  },
  prompt: [
    'Evaluate the motion quality of {target}.',
    '',
    'Source under review:',
    '```',
    '{source}',
    '```',
    '',
    '- Does the motion communicate something (state change, causality,',
    '  spatial relationship) or is it decorative?',
    '- Is the easing physically plausible? (Spring physics or custom-tuned',
    '  curves beat default ease/ease-in-out.)',
    '- Are durations proportionate? (Microinteractions <150ms; transitions',
    '  150–400ms; large layout shifts up to 600ms but rare.)',
    '- Do entrances/exits use the same envelope, or do they feel jarring?',
    '- Does the motion respect `prefers-reduced-motion`?',
    '- Are interruptions handled gracefully (e.g., reversing mid-flight',
    '  instead of snap-resetting)?',
    '',
    'Use the 3-axis output model (tier x impact x confidence). Confidence',
    'should drop on code-only analysis — motion quality is hard to judge',
    'without rendering.',
    '',
    'Respond with a single fenced ```json``` block containing an object:',
    '{',
    '  "tier": "foundational" | "polish" | "aspirational",',
    '  "impact": "small" | "medium" | "large",',
    '  "confidence": "high" | "medium" | "low",',
    '  "message": "<one-paragraph critique of what you see>"',
    '}',
  ].join('\n'),
  positiveExample: [
    'Stripe checkout amount input: spring-physics character ticker on',
    'value change, 180ms entrance with subtle scale + opacity, reversible',
    'mid-flight if value changes again. Respects reduced-motion (cross-',
    'fade fallback). Causality is clear — the number that animated is the',
    'number that changed.',
  ].join('\n'),
  negativeExample: [
    'Modal opens with 500ms ease-out, closes with instant snap. Hover',
    'micro-interaction uses 300ms linear (feels mechanical). No',
    'prefers-reduced-motion handling. A side panel slides in over 800ms,',
    'blocking the user from interacting with it during the slide.',
  ].join('\n'),
  findingTemplate: {
    code: 'CRAFT-C003',
    tier: 'polish',
    impact: 'medium',
    phase: 'critique',
  },
};
