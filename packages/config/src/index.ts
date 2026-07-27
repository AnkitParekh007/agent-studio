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
  return env;
}

export function corsOriginList(env: AppEnv): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
