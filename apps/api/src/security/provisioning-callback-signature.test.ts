import { describe, expect, it } from 'vitest';
import {
  signProvisioningCallback,
  verifyProvisioningCallbackSignature,
  type ProvisioningCallbackEnvelope,
} from './provisioning-callback-signature.js';

const secret = 'test-provisioning-secret';
const now = 1_786_000_000;

function envelope(overrides: Partial<ProvisioningCallbackEnvelope> = {}): ProvisioningCallbackEnvelope {
  const base = {
    timestamp: now,
    callbackId: 'callback-123',
    body: '{"status":"succeeded","attempt":2}',
  };
  return {
    ...base,
    signature: signProvisioningCallback(base, secret),
    ...overrides,
  };
}

describe('provisioning callback signatures', () => {
  it('accepts a valid fresh callback', () => {
    expect(() => verifyProvisioningCallbackSignature(envelope(), { secret, now })).not.toThrow();
  });

  it('rejects a modified body', () => {
    const signed = envelope();
    expect(() =>
      verifyProvisioningCallbackSignature(
        { ...signed, body: '{"status":"failed","attempt":2}' },
        { secret, now },
      ),
    ).toThrow(/Invalid provisioning callback signature/);
  });

  it('rejects callbacks outside the freshness window', () => {
    const oldTimestamp = now - 301;
    const old = {
      timestamp: oldTimestamp,
      callbackId: 'callback-old',
      body: '{}',
    };
    expect(() =>
      verifyProvisioningCallbackSignature(
        { ...old, signature: signProvisioningCallback(old, secret) },
        { secret, now, maxAgeSeconds: 300 },
      ),
    ).toThrow(/timestamp window/);
  });

  it('rejects an already consumed callback id', () => {
    expect(() =>
      verifyProvisioningCallbackSignature(envelope(), {
        secret,
        now,
        usedCallbackIds: new Set(['callback-123']),
      }),
    ).toThrow(/already been processed/);
  });

  it('rejects a signature created with another secret', () => {
    const input = envelope();
    const forged = {
      ...input,
      signature: signProvisioningCallback(input, 'wrong-secret'),
    };
    expect(() => verifyProvisioningCallbackSignature(forged, { secret, now })).toThrow(/Invalid provisioning callback signature/);
  });
});
