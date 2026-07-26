import { Inject, Injectable } from '@nestjs/common';
import { auditEvents, newId } from '@agent-studio/database';
import { redactUnknown } from '@agent-studio/domain';
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
}
