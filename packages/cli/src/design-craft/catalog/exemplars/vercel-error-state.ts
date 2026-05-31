// packages/cli/src/design-craft/catalog/exemplars/vercel-error-state.ts
//
// Phase 2 catalog increment — fourth exemplar. Closes the CRAFT-B004
// reservation called out in finding-codes.md (ErrorState anchor for the
// early v1 exemplar set), and gives the BENCHMARK loop a fourth
// componentType (EmptyState / LoadingState / CommandPalette / ErrorState).
//
// The exemplar is anchored on Vercel's deploy/build error surface — the
// canonical reference cited in the design-craft-elevator proposal's
// "Exemplar-driven targets" capability class (Vercel error page sits next
// to Linear empty list and Stripe loading state as a tier-1 anchor).
//
// Honors ADR 0020 (living catalog H pattern): provenance + contributors +
// versioning are required so usage signal + growth work.

import type { ExemplarDefinition } from './linear-empty-list.js';

export const vercelErrorStateExemplar: ExemplarDefinition = {
  id: 'exemplar-vercel-error-state',
  name: 'Vercel Error State',
  componentType: 'ErrorState',
  version: 1,
  status: 'stable',
  url: 'https://vercel.com/docs/deployments/troubleshoot-a-build',
  authoredAt: '2026-05-31',
  contributors: ['@chadjw'],
  source: {
    ref: 'vercel-geist#error-state',
    url: 'https://vercel.com/geist/introduction',
  },
  critique: [
    'Hierarchy: the failure headline reads first (concise, blame-free,',
    'names the failure type — "Build failed", "Module not found"), the',
    'most-actionable recovery sits second as a primary CTA, deeper',
    'diagnostics (stack trace, build log, framework hints) sit third in a',
    'collapsed-by-default panel. The eye lands on what happened, then on',
    'what to do, then on why if the user wants more.',
    'Typography: failure headline in display weight, recovery CTA in',
    'reading weight with verb-led label ("View build log", "Retry deploy"),',
    'log excerpts in tabular monospace with subdued contrast so they read',
    'as evidence rather than competing with the action. Numerals and file',
    'paths align column-wise.',
    'Visual: the error icon is a single restrained mark in the failure',
    'token color (not a large red banner); the surface stays calm rather',
    'than alarming. A subtle red accent on the icon and the headline',
    'underline is the entire signal — no full-bleed red fills, no warning',
    'striping. Failure is communicated by typography and structure, not by',
    'shouting.',
    'Density: generous whitespace around the failure cluster (headline +',
    "body + CTA) so the eye doesn't have to fight surrounding chrome;",
    "tighter spacing inside the collapsed diagnostics panel where it's",
    'scanning-territory. The recovery CTA gets a wider tap target than',
    'inline links.',
    'Motion: the error state cross-fades in over ~120ms (no jarring slam),',
    'the diagnostics expand with a tuned spring on toggle, the retry',
    'action has a settled hover-press feedback loop. No looping spinner',
    'on the failure surface itself — the failure is resolved, not still',
    'thinking.',
    'Copy: the failure description names the cause specifically ("Could',
    "not resolve module './components/Sidebar' in app/page.tsx\") and",
    'pairs it with the next action ("Check the import path or run',
    '`pnpm install`"). No "Error: Something went wrong" dead-ends. Tone',
    'is calm and forensic, not apologetic or panicky.',
  ].join('\n'),
  whyExemplar: [
    'Demonstrates that error states are first-class craft surfaces — not',
    'fallbacks to apologize for. The exemplar teaches the four-part',
    'anatomy of a high-craft error: (1) name the failure specifically,',
    '(2) lead with the recovery action, (3) keep diagnostics available',
    'but recessed, (4) communicate severity with typography and color',
    'tokens, not full-bleed red panels. Most competing error surfaces',
    'either alarm (red banner + alert icon + bold uppercase "ERROR") or',
    'apologize ("Oops! Something went wrong. Please try again later.") —',
    "Vercel's surface does neither, treating the user as a peer working a",
    'real problem. The hierarchy + restraint + copy-craft combination is',
    'the lesson, and it composes naturally with `CRAFT-C001` (hierarchy),',
    '`CRAFT-C006` (restraint), and `CRAFT-C008` (copy voice).',
  ].join('\n'),
  radarReference: {
    philosophicalCoherence: 92,
    hierarchy: 93,
    craftExecution: 91,
    function: 96,
    innovation: 78,
  },
  citationCount: 0,
};
