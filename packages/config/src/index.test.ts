import { describe, expect, it } from 'vitest';
import { loadEnv, oidcConfig } from './index.js';

const base = {
  DATABASE_URL: 'postgresql://x',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  SECRETS_MASTER_KEY: 'y'.repeat(32),
};

describe('loadEnv', () => {
  it('rejects local runtime in production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://x',
        BETTER_AUTH_SECRET: 'x'.repeat(32),
        SECRETS_MASTER_KEY: 'y'.repeat(32),
        RUNTIME_ALLOW_LOCAL: 'true',
      }),
    ).toThrow(/RUNTIME_ALLOW_LOCAL/);
  });

  it('rejects a partially configured OIDC provider', () => {
    expect(() => loadEnv({ ...base, OIDC_ISSUER_URL: 'https://idp.example.com' })).toThrow(/OIDC/);
  });
});

describe('oidcConfig', () => {
  it('returns null when SSO is not configured', () => {
    expect(oidcConfig(loadEnv(base))).toBeNull();
  });

  it('derives the discovery URL from the issuer', () => {
    const env = loadEnv({
      ...base,
      OIDC_ISSUER_URL: 'https://idp.example.com/',
      OIDC_CLIENT_ID: 'client',
      OIDC_CLIENT_SECRET: 'secret',
    });
    expect(oidcConfig(env)).toEqual({
      providerId: 'oidc',
      discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
      clientId: 'client',
      clientSecret: 'secret',
      scopes: ['openid', 'profile', 'email'],
    });
  });
});
