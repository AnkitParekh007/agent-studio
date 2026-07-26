import { Controller, Get, Header, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { MetricsService } from './core/metrics.service.js';
import { DB, type Db } from './core/tokens.js';

@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
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
  metricsText() {
    return this.metrics.prometheus();
  }

  @Get('api/metrics')
  metricsJson() {
    return this.metrics.snapshot();
  }
}
