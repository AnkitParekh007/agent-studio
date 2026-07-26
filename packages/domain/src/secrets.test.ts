import { describe, expect, it } from 'vitest';
import { redactSecrets, redactUnknown } from './secrets.js';

describe('redactSecrets', () => {
  it('redacts anthropic keys', () => {
    expect(redactSecrets('key=sk-ant-abc123DEF')).toContain('[REDACTED]');
  });
});

describe('redactUnknown', () => {
  it('redacts secret-like keys', () => {
    expect(redactUnknown({ apiKey: 'secret', ok: 'yes' })).toEqual({
      apiKey: '[REDACTED]',
      ok: 'yes',
    });
  });
});
