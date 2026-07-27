import { Controller, Get, Header, Inject, Req, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { MetricsService } from './core/metrics.service.js';
import { DB, ENV, type Db, type Env } from './core/tokens.js';

@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    await this.db.execute(sql`select 1`);
    return { status: 'ready' };
  }

  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  metricsText(@Req() req: FastifyRequest) {
    this.assertMetricsAuthorized(req);
    return this.metrics.prometheus();
  }

  @Get('api/metrics')
  metricsJson(@Req() req: FastifyRequest) {
    this.assertMetricsAuthorized(req);
    return this.metrics.snapshot();
  }

  /**
   * When METRICS_BEARER_TOKEN is set the scrape endpoints require it.
   * loadEnv() already refuses to boot production without a token.
   */
  private assertMetricsAuthorized(req: FastifyRequest) {
    const expected = this.env.METRICS_BEARER_TOKEN;
    if (!expected) return;
    const presented = Buffer.from(req.headers.authorization ?? '');
    const wanted = Buffer.from(`Bearer ${expected}`);
    if (presented.length !== wanted.length || !timingSafeEqual(presented, wanted)) {
      throw new UnauthorizedException('Metrics bearer token required');
    }
  }
}
