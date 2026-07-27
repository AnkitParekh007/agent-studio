import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  CONTROL_PLANE_ORIGIN: z.string().url().default('http://localhost:3000'),
  AGENT_RUNTIME_ORIGIN: z.string().url().default('http://localhost:3001'),
  EMBED_RUNTIME_ORIGIN: z.string().url().default('http://localhost:3002'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:4000'),
  SECRETS_MASTER_KEY: z.string().min(32),
  /** Number of trusted reverse-proxy hops in front of the API (drives client IP resolution). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  /** Enterprise OIDC (Better Auth genericOAuth). SSO is enabled only when all three are set. */
  OIDC_ISSUER_URL: z.string().optional().default(''),
  OIDC_CLIENT_ID: z.string().optional().default(''),
  OIDC_CLIENT_SECRET: z.string().optional().default(''),
  OIDC_PROVIDER_ID: z.string().default('oidc'),
  OIDC_SCOPES: z.string().default('openid,profile,email'),
  /** Per-IP fixed-window limit on /api/auth/*. */
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  /** Failed sign-ins (per IP + email) before the pair is locked out. */
  AUTH_LOCKOUT_MAX_FAILURES: z.coerce.number().int().positive().default(10),
  /** Window over which failed sign-ins accumulate (ms). */
  AUTH_LOCKOUT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  /** How long a locked-out IP + email pair stays locked (ms). */
  AUTH_LOCKOUT_DURATION_MS: z.coerce.number().int().positive().default(900_000),
  /** Soft gate: privileged roles must have MFA enrolled before using protected APIs. */
  REQUIRE_MFA_FOR_PRIVILEGED: z
    .preprocess((v) => v === true || v === 'true', z.boolean())
    .default(false),
  RUNTIME_ALLOW_LOCAL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  DEFAULT_RUNTIME_PROVIDER: z.enum(['local', 'claude']).default('local'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  /** When false (default), submitter cannot approve their own request. */
  ALLOW_SELF_APPROVAL: z.preprocess((v) => v === true || v === 'true', z.boolean()).default(false),
  GATEWAY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  GATEWAY_MAX_CONCURRENT_SESSIONS: z.coerce.number().int().positive().default(20),
  /** Soft session wall-clock timeout for gateway streams (ms). */
  GATEWAY_SESSION_TIMEOUT_MS: z.coerce.number().int().positive().default(900_000),
  /** OTLP HTTP traces endpoint, e.g. http://localhost:4318/v1/traces */
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().optional().default(''),
  OTEL_SERVICE_NAME: z.string().default('agent-studio-api'),
  /** Bearer token required for /metrics and /api/metrics. Required when NODE_ENV=production. */
  METRICS_BEARER_TOKEN: z.string().optional().default(''),
  /** Default retention window (days) when org setting is unset. */
  DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.RUNTIME_ALLOW_LOCAL) {
    throw new Error('RUNTIME_ALLOW_LOCAL cannot be true when NODE_ENV=production');
  }
  if (env.NODE_ENV === 'production' && !env.METRICS_BEARER_TOKEN) {
    throw new Error('METRICS_BEARER_TOKEN is required when NODE_ENV=production');
  }
  const oidcParts = [env.OIDC_ISSUER_URL, env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET];
  if (oidcParts.some(Boolean) && !oidcParts.every(Boolean)) {
    throw new Error(
      'OIDC requires OIDC_ISSUER_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET to be set together',
    );
  }
  return env;
}

export function corsOriginList(env: AppEnv): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export type OidcConfig = {
  providerId: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
};

/** Returns null when enterprise SSO is not configured, so Better Auth stays email/password only. */
export function oidcConfig(env: AppEnv): OidcConfig | null {
  if (!env.OIDC_ISSUER_URL || !env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET) return null;
  const issuer = env.OIDC_ISSUER_URL.replace(/\/$/, '');
  return {
    providerId: env.OIDC_PROVIDER_ID,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    scopes: env.OIDC_SCOPES.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
