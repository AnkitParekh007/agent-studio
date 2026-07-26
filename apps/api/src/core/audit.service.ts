import { Inject, Injectable } from '@nestjs/common';
import { auditEvents, newId } from '@agent-studio/database';
import { redactUnknown } from '@agent-studio/domain';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { DB, type Db } from './tokens.js';

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async record(input: {
    organizationId?: string | null;
    actorUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.db.insert(auditEvents).values({
      id: newId('audit'),
      organizationId: input.organizationId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      correlationId: input.correlationId,
      metadata: JSON.stringify(redactUnknown(input.metadata ?? {})),
    });
  }

  async list(
    organizationId: string,
    opts: {
      limit?: number;
      action?: string;
      resourceType?: string;
      from?: Date;
      to?: Date;
    } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const filters = [eq(auditEvents.organizationId, organizationId)];
    if (opts.action) filters.push(eq(auditEvents.action, opts.action));
    if (opts.resourceType) filters.push(eq(auditEvents.resourceType, opts.resourceType));
    if (opts.from) filters.push(gte(auditEvents.createdAt, opts.from));
    if (opts.to) filters.push(lte(auditEvents.createdAt, opts.to));

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...filters))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      actorUserId: r.actorUserId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      correlationId: r.correlationId,
      metadata: JSON.parse(r.metadata || '{}') as Record<string, unknown>,
      createdAt: r.createdAt,
    }));
  }
}
