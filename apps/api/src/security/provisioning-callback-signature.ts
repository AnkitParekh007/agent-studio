import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ProvisioningCallbackEnvelope {
  timestamp: number;
  callbackId: string;
  body: string;
  signature: string;
}

export interface ProvisioningCallbackVerificationOptions {
  secret: string;
  now?: number;
  maxAgeSeconds?: number;
  usedCallbackIds?: ReadonlySet<string>;
}

function canonicalPayload(envelope: Pick<ProvisioningCallbackEnvelope, 'timestamp' | 'callbackId' | 'body'>): string {
  return `${envelope.timestamp}.${envelope.callbackId}.${envelope.body}`;
}

export function signProvisioningCallback(
  envelope: Pick<ProvisioningCallbackEnvelope, 'timestamp' | 'callbackId' | 'body'>,
  secret: string,
): string {
  if (!secret) throw new Error('Provisioning callback secret is required');
  const digest = createHmac('sha256', secret).update(canonicalPayload(envelope)).digest('hex');
  return `sha256=${digest}`;
}

/**
 * API-edge verification for external provisioning/build callbacks.
 *
 * Domain policy separately validates idempotency key + attempt ordering. This
 * helper verifies authenticity, freshness, and callback-id replay before the
 * callback is allowed to reach that domain policy.
 */
export function verifyProvisioningCallbackSignature(
  envelope: ProvisioningCallbackEnvelope,
  options: ProvisioningCallbackVerificationOptions,
): void {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? 300;

  if (!options.secret) throw new Error('Provisioning callback secret is required');
  if (!Number.isInteger(envelope.timestamp) || envelope.timestamp <= 0) {
    throw new Error('Invalid provisioning callback timestamp');
  }
  if (!envelope.callbackId.trim()) {
    throw new Error('Provisioning callback id is required');
  }
  if (Math.abs(now - envelope.timestamp) > maxAgeSeconds) {
    throw new Error('Provisioning callback is outside the allowed timestamp window');
  }
  if (options.usedCallbackIds?.has(envelope.callbackId)) {
    throw new Error(`Provisioning callback ${envelope.callbackId} has already been processed`);
  }

  const expected = signProvisioningCallback(envelope, options.secret);
  const actualBuffer = Buffer.from(envelope.signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid provisioning callback signature');
  }
}
