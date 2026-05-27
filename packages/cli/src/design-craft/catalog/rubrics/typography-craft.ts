// packages/cli/src/design-craft/catalog/rubrics/typography-craft.ts
//
// Second Phase 2 catalog rubric — ported from the Phase 0 paper spike:
//   docs/changes/design-pipeline/design-craft-elevator/phase-0-schema-spike/
//   rubrics/typography-craft.md
//
// CRAFT-C002 — fills the typographic dimension of the seed catalog. Pairs
// with hierarchy-clarity (CRAFT-C001) and motion-quality (CRAFT-C003) to
// give the Phase 2 increment a meaningful three-rubric critique surface.

import type { RubricDefinition } from './hierarchy-clarity.js';

export const typographyCraftRubric: RubricDefinition = {
  id: 'rubric-typography-craft',
  name: 'Typography Craft',
  version: 1,
  status: 'stable',
  authoredAt: '2026-05-23',
  contributors: ['@chadjw'],
  appliesTo: ['component', 'page'],
  source: {
    ref: 'vercel-geist#typography',
    url: 'https://vercel.com/geist/introduction',
  },
  prompt: [
    'Evaluate the typographic craft of {target}.',
    '',
    'Source under review:',
    '```',
    '{source}',
    '```',
    '',
    '- Is the type scale consistent (modular, or at least intentionally',
    '  chosen ratios) or arbitrary?',
    '- Are line-heights tuned to font size and reading width? (Body copy',
    '  typically 1.4–1.6; headings 1.05–1.25.)',
    '- Is measure (line length) within the 45–75 char reading band for',
    '  body copy?',
    '- Is letter-spacing tuned at display sizes? (Large headings usually',
    '  benefit from slight negative tracking.)',
    '- Is font-weight contrast meaningful (e.g., 400 vs 600) or muddy',
    '  (e.g., 400 vs 500)?',
    '- Are numerals tabular where alignment matters (tables, prices)?',
    '',
    'Use the 3-axis output model (tier x impact x confidence). Confidence',
    'should drop when the target lacks a declared type scale to compare',
    'against.',
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
    'Geist Sans + Geist Mono pair: explicit modular scale, tuned',
    'line-heights per role (display, heading, body, caption), tabular',
    'numerals on pricing rows, negative tracking on display sizes. Every',
    'text element has an obvious role in the scale.',
  ].join('\n'),
  negativeExample: [
    'Headings, body, and captions all set in same weight at 14/16/18 with',
    'default 1.5 line-height. No visible scale, no role differentiation,',
    'letter-spacing untouched at all sizes. Numerals proportional inside',
    'a pricing table — columns misalign.',
  ].join('\n'),
  findingTemplate: {
    code: 'CRAFT-C002',
    tier: 'foundational',
    impact: 'medium',
    phase: 'critique',
  },
};
