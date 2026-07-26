import { describe, expect, it } from 'vitest';
import { loadEnv } from './index.js';

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
});
