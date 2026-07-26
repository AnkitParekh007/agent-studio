import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, generatePublicationToken, hashToken } from './secret-crypto.js';

describe('secret-crypto', () => {
  it('round-trips AES-256-GCM payloads', () => {
    const master = 'test-master-key-at-least-32-characters-long!!';
    const enc = encryptSecret(master, 'super-secret-value');
    expect(enc.ciphertext).toBeTruthy();
    expect(decryptSecret(master, enc)).toBe('super-secret-value');
  });

  it('hashes publication tokens stably', () => {
    const token = generatePublicationToken();
    expect(token.startsWith('pub_')).toBe(true);
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});
