/**
 * Guards the production environment contract without booting the stack:
 * loadEnv() must reject RUNTIME_ALLOW_LOCAL=true and a missing METRICS_BEARER_TOKEN
 * when NODE_ENV=production, and accept a minimal, correctly configured prod env.
 *
 * Usage: node scripts/check-production-env.mjs
 */
import { loadEnv } from '../packages/config/dist/index.js';

const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://agentstudio:agentstudio@postgres:5432/agentstudio',
  REDIS_URL: 'redis://redis:6379',
  BETTER_AUTH_SECRET: 'prod-better-auth-secret-at-least-32-chars!!',
  SECRETS_MASTER_KEY: 'prod-secrets-master-key-at-least-32-chars!!',
  DEFAULT_RUNTIME_PROVIDER: 'claude',
  METRICS_BEARER_TOKEN: 'prod-metrics-bearer-token',
};

function expectReject(env, label) {
  try {
    loadEnv(env);
  } catch {
    console.log(`ok: rejected ${label}`);
    return;
  }
  console.error(`FAIL: loadEnv accepted ${label}`);
  process.exit(1);
}

expectReject({ ...base, RUNTIME_ALLOW_LOCAL: 'true' }, 'RUNTIME_ALLOW_LOCAL=true in production');
expectReject({ ...base, METRICS_BEARER_TOKEN: '' }, 'missing METRICS_BEARER_TOKEN in production');

const env = loadEnv(base);
if (env.RUNTIME_ALLOW_LOCAL) {
  console.error('FAIL: RUNTIME_ALLOW_LOCAL should default to false');
  process.exit(1);
}
if (env.DATA_RETENTION_DAYS !== 90) {
  console.error(`FAIL: expected DATA_RETENTION_DAYS default 90, got ${env.DATA_RETENTION_DAYS}`);
  process.exit(1);
}

console.log('ok: minimal production env accepted');
console.log('Production env contract OK');
