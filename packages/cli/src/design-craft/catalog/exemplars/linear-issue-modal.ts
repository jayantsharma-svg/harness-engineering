// packages/cli/src/design-craft/catalog/exemplars/linear-issue-modal.ts
//
// Phase 2 catalog increment — fifth exemplar. Closes the CRAFT-B005
// reservation called out in finding-codes.md (Modal anchor for the early
// v1 exemplar set), and brings the BENCHMARK loop to five componentTypes
// (EmptyState / LoadingState / CommandPalette / ErrorState / Modal). With
// this entry, the seed exemplar set spans every component type listed in
// the spec's "10 exemplars per type x 5 types = 50 exemplars" plan from
// at least one anchor each — the catalog can grow horizontally (more per
// type) without needing to introduce new types first.
//
// Linear's issue-detail modal is the anchor because it is the canonical
// reference for a high-density Modal that resists every standard failure
// mode of the form (focal-action overload, nested-card chrome, dimmer
// spectacle, motion that fights the keyboard user).
//
// Honors ADR 0020 (living catalog H pattern): provenance + contributors +
// versioning are required so usage signal + growth work.

import type { ExemplarDefinition } from './linear-empty-list.js';

export const linearIssueModalExemplar: ExemplarDefinition = {
  id: 'exemplar-linear-issue-modal',
  name: 'Linear Issue Detail Modal',
  componentType: 'Modal',
  version: 1,
  status: 'stable',
  url: 'https://linear.app/method',
  authoredAt: '2026-05-31',
  contributors: ['@chadjw'],
  source: {
    ref: 'linear-app#issue-modal',
    url: 'https://linear.app/method',
  },
  critique: [
    'Hierarchy: the title bar (issue identifier + title) reads first as',
    'the single largest text on the surface; the description body reads',
    'second in reading weight at a tuned measure; the metadata sidebar',
    '(status, assignee, priority, labels, links) reads third as a',
    'right-aligned column with tabular metadata rows. Comments thread',
    'sits below the description with a clear sub-section break. No two',
    'regions compete for primary attention.',
    'Typography: title in display weight with tracked-tight letter-',
    'spacing; description in reading weight at ~65 char measure;',
    'metadata rows in reading weight with subdued contrast labels and',
    'normal-contrast values; comment timestamps in tabular monospace at',
    'reduced size. Five distinct typographic roles, each cleanly',
    'separated.',
    'Visual: a single rounded surface with one outline border — no',
    'nested cards, no banded headers, no decorative dividers between',
    'description and comments. The dim layer behind the modal is a',
    'subtle ~40% black, not the full theatrical blackout of competing',
    'modals; the page beneath stays legible enough that the user',
    'remembers context. The close affordance is a single icon button',
    "top-right; there's no redundant header X plus footer Cancel.",
    'Density: comfortable but not lavish — the description region',
    'breathes (the issue is the focus), the metadata sidebar is dense',
    'enough to scan at a glance (tight pair-vs-group gaps), the comment',
    'rows are compact (you can scan ten in a screen) without crowding.',
    'Vertical rhythm is locked across all three regions.',
    'Motion: opens with a tuned spring scale + opacity (no slide-from-',
    'edge theatrics); closes with the inverse envelope. The dim layer',
    'cross-fades on the same curve. Escape closes immediately with the',
    'same motion. Inline edits within the modal (status change, label',
    'add) are optimistic with inline rollback — no spinners blocking the',
    'modal during background mutations.',
    'Interaction: Tab order follows visual order (title → description →',
    'metadata top-to-bottom → comments → close). Escape closes; Cmd+Enter',
    'submits the active comment; arrow keys navigate the metadata',
    'select-rows. The modal is the focused surface — the page beneath',
    "can't be tabbed into until the modal closes, but pointer hover on",
    'background regions still surfaces tooltips so context is not lost.',
  ].join('\n'),
  whyExemplar: [
    'Demonstrates the high-craft Modal pattern most product modals fail:',
    '(1) one focal region, not three competing ones; (2) flat surface,',
    'not nested cards-in-cards; (3) restrained dimmer, not theatrical',
    'blackout; (4) tuned spring motion paired with instant keyboard',
    'response; (5) optimistic inline mutations, not blocking spinners.',
    'Most competing issue / task / record modals fall into at least three',
    'of these traps (a tabbed header competing with the body, a nested',
    'card per metadata group, a full-black dim layer, slide-in motion',
    'that interferes with rapid keyboard editing, every save round-',
    "tripping through a spinner). Linear's issue modal is the proof",
    'point that a Modal can carry significant content density without',
    'losing focus, and that "stunning" at this component type means',
    '"every region is doing intentional work" rather than "more',
    'chrome." The exemplar composes naturally with `CRAFT-C001`',
    '(hierarchy), `CRAFT-C006` (restraint), and `CRAFT-C009`',
    '(interaction craft).',
  ].join('\n'),
  radarReference: {
    philosophicalCoherence: 94,
    hierarchy: 93,
    craftExecution: 93,
    function: 95,
    innovation: 82,
  },
  citationCount: 0,
};
