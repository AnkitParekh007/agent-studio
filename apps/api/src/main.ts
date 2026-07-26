import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { corsOriginList, loadEnv } from '@agent-studio/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableCors({
    origin: corsOriginList(env),
    credentials: true,
  });

  await app.listen(env.API_PORT, '0.0.0.0');
  console.log(`Agent Studio API listening on ${env.API_BASE_URL}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
