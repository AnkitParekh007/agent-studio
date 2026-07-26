import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { corsOriginList, loadEnv } from '@agent-studio/config';
import { AppModule } from './app.module.js';
import { logError, logInfo } from './core/logger.js';

async function bootstrap() {
  const env = loadEnv();
  const adapter = new FastifyAdapter({ logger: true });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', async (req, reply) => {
    const incoming =
      (typeof req.headers['x-correlation-id'] === 'string' && req.headers['x-correlation-id']) ||
      (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id']) ||
      randomUUID();
    (req as { correlationId?: string }).correlationId = incoming;
    void reply.header('x-correlation-id', incoming);
  });

  app.enableCors({
    origin: corsOriginList(env),
    credentials: true,
  });

  await app.listen(env.API_PORT, '0.0.0.0');
  logInfo('api_listening', { baseUrl: env.API_BASE_URL, port: env.API_PORT });
}

bootstrap().catch((err) => {
  logError('api_bootstrap_failed', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
