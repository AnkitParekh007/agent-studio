import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

export function deriveSecretKey(masterKey: string): Buffer {
  return createHash('sha256').update(masterKey, 'utf8').digest();
}

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export function encryptSecret(masterKey: string, plaintext: string): EncryptedSecret {
  const key = deriveSecretKey(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptSecret(masterKey: string, payload: EncryptedSecret): string {
  const key = deriveSecretKey(masterKey);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generatePublicationToken(): string {
  return `pub_${randomBytes(32).toString('hex')}`;
}
