import { Inject, Injectable } from '@nestjs/common';
import {
  agentDefinitions,
  memberships,
  organizationSettings,
  organizations,
  runtimeEvents,
  runtimeSessions,
  usageRecords,
  users,
} from '@agent-studio/database';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, ENV, type Db, type Env } from '../core/tokens.js';

@Injectable()
export class RetentionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async getRetentionDays(organizationId: string) {
    const [settings] = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);
    return settings?.retentionDays ?? this.env.DATA_RETENTION_DAYS;
  }

  /** Deletes runtime telemetry older than the org retention window. Idempotent. */
  async purge(ctx: RequestContext) {
    const retentionDays = await this.getRetentionDays(ctx.organizationId);
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deletedEvents = await this.db
      .delete(runtimeEvents)
      .where(
        and(
          eq(runtimeEvents.organizationId, ctx.organizationId),
          lt(runtimeEvents.createdAt, cutoff),
        ),
      )
      .returning({ id: runtimeEvents.id });

    const deletedUsage = await this.db
      .delete(usageRecords)
      .where(
        and(
          eq(usageRecords.organizationId, ctx.organizationId),
          lt(usageRecords.createdAt, cutoff),
        ),
      )
      .returning({ id: usageRecords.id });

    const deletedSessions = await this.db
      .delete(runtimeSessions)
      .where(
        and(
          eq(runtimeSessions.organizationId, ctx.organizationId),
          isNotNull(runtimeSessions.endedAt),
          lt(runtimeSessions.endedAt, cutoff),
        ),
      )
      .returning({ id: runtimeSessions.id });

    const result = {
      retentionDays,
      cutoff: cutoff.toISOString(),
      deletedRuntimeEvents: deletedEvents.length,
      deletedUsageRecords: deletedUsage.length,
      deletedRuntimeSessions: deletedSessions.length,
    };

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'org.retention_purged',
      resourceType: 'organization',
      resourceId: ctx.organizationId,
      metadata: result,
    });

    return result;
  }

  /** Org-scoped metadata export. Never includes secret values or event payloads. */
  async exportOrganization(ctx: RequestContext) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1);

    const members = await this.db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        roleKey: memberships.roleKey,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.organizationId, ctx.organizationId));

    const agents = await this.db
      .select({
        id: agentDefinitions.id,
        name: agentDefinitions.name,
        slug: agentDefinitions.slug,
        lifecycleStatus: agentDefinitions.lifecycleStatus,
      })
      .from(agentDefinitions)
      .where(eq(agentDefinitions.organizationId, ctx.organizationId));

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'org.exported',
      resourceType: 'organization',
      resourceId: ctx.organizationId,
      metadata: { memberCount: members.length, agentCount: agents.length },
    });

    return {
      exportedAt: new Date().toISOString(),
      organization: org
        ? { id: org.id, name: org.name, slug: org.slug, createdAt: org.createdAt }
        : null,
      retentionDays: await this.getRetentionDays(ctx.organizationId),
      members,
      agents,
    };
  }
}
