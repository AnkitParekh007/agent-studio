import { Injectable } from '@nestjs/common';

type CounterMap = Map<string, number>;

@Injectable()
export class MetricsService {
  private readonly counters: CounterMap = new Map();
  private readonly startedAt = Date.now();

  increment(name: string, by = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  snapshot() {
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      counters: Object.fromEntries(this.counters.entries()),
    };
  }

  /** Prometheus text exposition (minimal). */
  prometheus(): string {
    const lines = [
      '# HELP agent_studio_uptime_seconds Process uptime in seconds',
      '# TYPE agent_studio_uptime_seconds gauge',
      `agent_studio_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`,
    ];
    for (const [name, value] of this.counters) {
      const metric = `agent_studio_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      lines.push(`# TYPE ${metric} counter`);
      lines.push(`${metric} ${value}`);
    }
    return `${lines.join('\n')}\n`;
  }
}
