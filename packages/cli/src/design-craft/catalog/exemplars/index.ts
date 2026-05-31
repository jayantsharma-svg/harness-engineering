// packages/cli/src/design-craft/catalog/exemplars/index.ts
//
// Barrel for the Phase 2 seed of exemplars.

export type { ExemplarDefinition, RadarReference, ComponentType } from './linear-empty-list.js';

import type { ExemplarDefinition } from './linear-empty-list.js';
import { linearEmptyListExemplar } from './linear-empty-list.js';
import { stripeLoadingStateExemplar } from './stripe-loading-state.js';
import { raycastCommandPaletteExemplar } from './raycast-command-palette.js';
import { vercelErrorStateExemplar } from './vercel-error-state.js';
import { linearIssueModalExemplar } from './linear-issue-modal.js';

export { linearEmptyListExemplar } from './linear-empty-list.js';
export { stripeLoadingStateExemplar } from './stripe-loading-state.js';
export { raycastCommandPaletteExemplar } from './raycast-command-palette.js';
export { vercelErrorStateExemplar } from './vercel-error-state.js';
export { linearIssueModalExemplar } from './linear-issue-modal.js';

/**
 * Seed exemplars. The earlier Phase 2 increment anchored the shape with
 * Linear's empty list (EmptyState); the catalog-widen commit added Stripe
 * loading + Raycast command palette to bring BENCHMARK to three component
 * types. This increment closes the two CRAFT-B004 / CRAFT-B005 anchor
 * reservations from `finding-codes.md` by porting in Vercel's error state
 * (ErrorState) and Linear's issue-detail modal (Modal) — together they
 * complete the early v1 exemplar set so the BENCHMARK loop now covers
 * five component types (EmptyState, LoadingState, CommandPalette,
 * ErrorState, Modal). The full 50-exemplar seed (10 per type for 5
 * canonical types) grows horizontally from here per the spec.
 *
 * Order matters: anchors LoadingState and CommandPalette next to
 * EmptyState so test snapshots, finding listings, and dashboard stats
 * render in a stable sequence; the two new entries land at the tail in
 * landing order so anchor codes (CRAFT-B001..B005) align with the array
 * index.
 */
export const SEED_EXEMPLARS: readonly ExemplarDefinition[] = [
  linearEmptyListExemplar,
  stripeLoadingStateExemplar,
  raycastCommandPaletteExemplar,
  vercelErrorStateExemplar,
  linearIssueModalExemplar,
];
