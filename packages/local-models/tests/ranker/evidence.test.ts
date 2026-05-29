import { describe, expect, it } from 'vitest';

import { EVIDENCE_CONFIDENCE, gradeEvidence } from '../../src/ranker/evidence.js';

describe('gradeEvidence — direct match (OT1)', () => {
  it('returns direct when model and quant both match', () => {
    const result = gradeEvidence({
      observationModel: 'Qwen/Qwen3-32B-GGUF',
      observationQuant: 'Q4_K_M',
      targetModel: 'Qwen/Qwen3-32B-GGUF',
      targetQuant: 'Q4_K_M',
    });
    expect(result.grade).toBe('direct');
    expect(result.confidence).toBe(EVIDENCE_CONFIDENCE.direct);
  });

  it('honours quant alias normalisation when matching direct', () => {
    const result = gradeEvidence({
      observationModel: 'Qwen/Qwen3-32B-GGUF',
      observationQuant: 'q4_k_m',
      targetModel: 'Qwen/Qwen3-32B-GGUF',
      targetQuant: 'Q4_K_M',
    });
    expect(result.grade).toBe('direct');
  });
});

describe('gradeEvidence — degraded matches (OT2)', () => {
  it('returns variant when the model id matches but quants differ', () => {
    const result = gradeEvidence({
      observationModel: 'Qwen/Qwen3-32B-GGUF',
      observationQuant: 'Q5_K_M',
      targetModel: 'Qwen/Qwen3-32B-GGUF',
      targetQuant: 'Q4_K_M',
    });
    expect(result.grade).toBe('variant');
    expect(result.confidence).toBe(EVIDENCE_CONFIDENCE.variant);
  });

  it('returns variant when only the GGUF mirror suffix differs', () => {
    const result = gradeEvidence({
      observationModel: 'Qwen/Qwen3-32B-GGUF',
      observationQuant: 'Q5_K_M',
      targetModel: 'Qwen/Qwen3-32B',
      targetQuant: 'Q4_K_M',
    });
    expect(result.grade).toBe('variant');
  });

  it('returns base when only the family root matches (different size suffix stripped path)', () => {
    const result = gradeEvidence({
      observationModel: 'Qwen/Qwen3-7B-GGUF',
      observationQuant: 'Q4_K_M',
      targetModel: 'Qwen/Qwen3-32B-GGUF',
      targetQuant: 'Q4_K_M',
    });
    expect(result.grade).toBe('base');
    expect(result.confidence).toBe(EVIDENCE_CONFIDENCE.base);
  });

  it('returns interpolated when the families differ entirely', () => {
    const result = gradeEvidence({
      observationModel: 'meta-llama/Llama-3-70B-Instruct',
      targetModel: 'Qwen/Qwen3-32B-GGUF',
    });
    expect(result.grade).toBe('interpolated');
    expect(result.confidence).toBe(EVIDENCE_CONFIDENCE.interpolated);
  });

  it('returns interpolated when only a lineagePosition hint is provided', () => {
    const result = gradeEvidence({
      observationModel: 'meta-llama/Llama-2-70B',
      targetModel: 'Qwen/Qwen3-32B',
      lineagePosition: 2,
    });
    expect(result.grade).toBe('interpolated');
  });
});

describe('gradeEvidence — self-reported absorbs', () => {
  it('returns self-reported even when the model and quant are an exact match', () => {
    const result = gradeEvidence({
      observationModel: 'Qwen/Qwen3-32B-GGUF',
      observationQuant: 'Q4_K_M',
      observationEvidence: 'self-reported',
      targetModel: 'Qwen/Qwen3-32B-GGUF',
      targetQuant: 'Q4_K_M',
    });
    expect(result.grade).toBe('self-reported');
    expect(result.confidence).toBe(EVIDENCE_CONFIDENCE['self-reported']);
  });

  it('returns self-reported when no model id overlap exists', () => {
    const result = gradeEvidence({
      observationModel: 'meta-llama/Llama-3-70B',
      observationEvidence: 'self-reported',
      targetModel: 'Qwen/Qwen3-32B',
    });
    expect(result.grade).toBe('self-reported');
  });
});

describe('gradeEvidence — confidence ladder is monotone descending', () => {
  it('keeps every adjacent rung at least 0.15 apart', () => {
    expect(EVIDENCE_CONFIDENCE.direct - EVIDENCE_CONFIDENCE.variant).toBeGreaterThanOrEqual(0.15);
    expect(EVIDENCE_CONFIDENCE.variant - EVIDENCE_CONFIDENCE.base).toBeGreaterThanOrEqual(0.15);
    expect(EVIDENCE_CONFIDENCE.base - EVIDENCE_CONFIDENCE.interpolated).toBeGreaterThanOrEqual(
      0.15
    );
    expect(
      EVIDENCE_CONFIDENCE.interpolated - EVIDENCE_CONFIDENCE['self-reported']
    ).toBeGreaterThanOrEqual(0.15);
  });
});
