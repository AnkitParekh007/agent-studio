import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  CONTROL_PLANE_ORIGIN: z.string().url().default('http://localhost:3000'),
  AGENT_RUNTIME_ORIGIN: z.string().url().default('http://localhost:3001'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
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
  return env;
}

export function corsOriginList(env: AppEnv): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
