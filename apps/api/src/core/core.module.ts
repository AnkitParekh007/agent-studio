import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { createAuth } from '@agent-studio/auth';
import { corsOriginList, loadEnv, oidcConfig } from '@agent-studio/config';
import { createDb } from '@agent-studio/database';
import { RuntimeProviderRegistry } from '@agent-studio/runtime-core';
import { tryCreateClaudeAdapter } from '@agent-studio/runtime-claude';
import { LocalRuntimeAdapter } from '@agent-studio/runtime-local';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  AUTH,
  DB,
  ENV,
  PROVISION_QUEUE,
  REDIS,
  RUNTIME_REGISTRY,
  type Redis as RedisClient,
} from './tokens.js';
import { AuditService } from './audit.service.js';
import { MetricsService } from './metrics.service.js';

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: () => loadEnv(),
    },
    {
      provide: DB,
      inject: [ENV],
      useFactory: (env: ReturnType<typeof loadEnv>) => createDb(env.DATABASE_URL),
    },
    {
      provide: AUTH,
      inject: [DB, ENV],
      useFactory: (db: ReturnType<typeof createDb>, env: ReturnType<typeof loadEnv>) =>
        createAuth({
          db,
          secret: env.BETTER_AUTH_SECRET,
          baseURL: env.BETTER_AUTH_URL,
          trustedOrigins: corsOriginList(env),
          oidc: oidcConfig(env),
        }),
    },
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: ReturnType<typeof loadEnv>) =>
        new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 }),
    },
    {
      provide: RUNTIME_REGISTRY,
      inject: [ENV],
      useFactory: (env: ReturnType<typeof loadEnv>) => {
        const registry = new RuntimeProviderRegistry();
        registry.register(
          new LocalRuntimeAdapter({
            allowLocal: Boolean(env.RUNTIME_ALLOW_LOCAL),
            nodeEnv: env.NODE_ENV,
          }),
        );
        const claude = tryCreateClaudeAdapter({
          apiKey: env.ANTHROPIC_API_KEY || undefined,
          baseUrl: env.ANTHROPIC_BASE_URL,
        });
        if (claude) {
          registry.register(claude);
        }
        return registry;
      },
    },
    {
      provide: PROVISION_QUEUE,
      inject: [ENV],
      useFactory: (env: ReturnType<typeof loadEnv>) =>
        new Queue('agent-provision', { connection: { url: env.REDIS_URL } }),
    },
    AuditService,
    MetricsService,
  ],
  exports: [ENV, DB, AUTH, REDIS, RUNTIME_REGISTRY, PROVISION_QUEUE, AuditService, MetricsService],
})
export class CoreModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
