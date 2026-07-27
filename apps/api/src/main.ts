import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { context, propagation, trace } from '@opentelemetry/api';
import { corsOriginList, loadEnv } from '@agent-studio/config';
import { AppModule } from './app.module.js';
import { logError, logInfo } from './core/logger.js';
import { initOpenTelemetry } from './core/otel.js';

async function bootstrap() {
  const env = loadEnv();
  initOpenTelemetry({
    serviceName: env.OTEL_SERVICE_NAME,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || undefined,
  });

  const adapter = new FastifyAdapter({ logger: true, trustProxy: true });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', async (req, reply) => {
    const incoming =
      (typeof req.headers['x-correlation-id'] === 'string' && req.headers['x-correlation-id']) ||
      (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id']) ||
      randomUUID();
    (req as { correlationId?: string }).correlationId = incoming;
    void reply.header('x-correlation-id', incoming);

    const tracer = trace.getTracer('agent-studio-api');
    const extracted = propagation.extract(context.active(), req.headers);
    const span = tracer.startSpan(
      `${req.method} ${req.url}`,
      {
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'correlation.id': incoming,
        },
      },
      extracted,
    );
    (req as { otelSpan?: ReturnType<typeof tracer.startSpan> }).otelSpan = span;
  });
  fastify.addHook('onResponse', async (req) => {
    const span = (req as { otelSpan?: { end: () => void } }).otelSpan;
    span?.end();
  });

  app.enableCors({
    origin: corsOriginList(env),
    credentials: true,
  });

  await app.listen(env.API_PORT, '0.0.0.0');
  logInfo('api_listening', {
    baseUrl: env.API_BASE_URL,
    port: env.API_PORT,
    otel: Boolean(env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT),
  });
}

bootstrap().catch((err) => {
  logError('api_bootstrap_failed', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
