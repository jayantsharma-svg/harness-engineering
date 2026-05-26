import type { SpecRubric } from './types.js';

export const sharpnessRubric: SpecRubric = {
  id: 'SPEC-R001',
  title: 'Sharpness vs vagueness',
  description:
    'Does the section state specific things or wave at them? Vague language ' +
    '(reasonable, robust, scalable, modern, clean, simple) without operational ' +
    'definition is a tell. A sharp section uses concrete nouns, numeric thresholds, ' +
    'or named patterns that a reader could verify.',
  source: 'Patterson, "How to Write Specs That Survive" (general spec-quality canon)',
  appliesToSections: ['*'],
  contribution: { addedAt: '2026-05-25', addedBy: 'seed' },
  signal: { invocations: 0, suppressedAt: [] },
  version: 1,
};
