import { describe, it, expect } from 'vitest';
import { parseStatusEnvelope } from '../../src/maintenance/check-script-runner';

describe('parseStatusEnvelope', () => {
  it('parses an "ok" status', () => {
    const env = parseStatusEnvelope('hello\n{"status":"ok"}');
    expect(env?.status).toBe('ok');
  });

  it('parses a "findings" envelope with wakeAgent + outputs', () => {
    const out =
      'lots of text\n{"status":"findings","findings":4,"wakeAgent":true,"outputs":{"x":1}}';
    const env = parseStatusEnvelope(out);
    expect(env?.status).toBe('findings');
    expect(env?.findings).toBe(4);
    expect(env?.wakeAgent).toBe(true);
    expect(env?.outputs).toEqual({ x: 1 });
  });

  it('parses a "skip" envelope with message', () => {
    const env = parseStatusEnvelope('{"status":"skip","message":"nothing to do"}');
    expect(env?.status).toBe('skip');
    expect(env?.message).toBe('nothing to do');
  });

  it('returns null for unrecognized status', () => {
    expect(parseStatusEnvelope('{"status":"unknown"}')).toBeNull();
  });

  it('returns null for non-JSON stdout', () => {
    expect(parseStatusEnvelope('just some text')).toBeNull();
  });

  it('scans backward past trailing warnings to find the envelope', () => {
    const out = '{"status":"findings","findings":2}\nWARNING: cleanup ran late\n';
    const env = parseStatusEnvelope(out);
    expect(env?.status).toBe('findings');
    expect(env?.findings).toBe(2);
  });

  it('ignores malformed JSON lines and returns null when nothing parses', () => {
    expect(parseStatusEnvelope('{not valid\n{also not}')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(parseStatusEnvelope('')).toBeNull();
  });
});
