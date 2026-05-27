import { describe, expect, it } from 'vitest';
import { LOCAL_MODELS_PACKAGE, LOCAL_MODELS_VERSION } from '../src/index.js';

describe('@harness-engineering/local-models scaffold', () => {
  it('exposes the package identifier constant', () => {
    expect(LOCAL_MODELS_PACKAGE).toBe('@harness-engineering/local-models');
  });

  it('exposes a version constant matching package.json', () => {
    expect(LOCAL_MODELS_VERSION).toBe('0.1.0');
  });
});
