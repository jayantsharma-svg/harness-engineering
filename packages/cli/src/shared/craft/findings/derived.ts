// packages/cli/src/shared/craft/findings/derived.ts
//
// Extracted from packages/cli/src/design-craft/findings/derived.ts on the
// 2nd-non-design-craft-consumer trigger (spec-craft).
//
// Derives the numeric `priority` surface from the 3-axis (tier × impact ×
// confidence) finding model. Per ADR 0019, the raw axes remain the
// authoritative output; this derivation is for stable sort/display ONLY.
//
// MVP rule:
//
//   priority = TIER_BAND[tier] + IMPACT_WEIGHT[impact] * CONFIDENCE_WEIGHT[confidence]
//
// with TIER_BAND set on order-of-magnitude steps so the band always
// dominates within-band score (cf. CVSS / Sonar severity bands).

import type { Tier, Impact, Confidence } from './axes.js';

const TIER_BAND: Record<Tier, number> = {
  foundational: 1000,
  polish: 100,
  aspirational: 10,
};

const IMPACT_WEIGHT: Record<Impact, number> = {
  large: 9,
  medium: 6,
  small: 3,
};

const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  high: 5,
  medium: 3,
  low: 1,
};

/**
 * Compute the sortable priority surface for a finding.
 *
 * Formula: `band(tier) + impact * confidence`, where band(tier) is an
 * order-of-magnitude bump so a foundational/small/low (1000 + 3) outranks
 * any polish/large/high (100 + 45), and a polish/small/low (100 + 3)
 * outranks any aspirational/large/high (10 + 45).
 *
 * Returns a positive number. Higher = more urgent. Stable across runs.
 */
export function derivePriority(tier: Tier, impact: Impact, confidence: Confidence): number {
  return TIER_BAND[tier] + IMPACT_WEIGHT[impact] * CONFIDENCE_WEIGHT[confidence];
}
