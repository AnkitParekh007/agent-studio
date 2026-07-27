import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  agentDefinitions,
  auditEvents,
  memberships,
  organizationSettings,
  organizations,
  runtimeEvents,
  runtimeSessions,
  usageRecords,
  users,
} from '@agent-studio/database';
import { and, desc, eq, isNotNull, lt, sql } from 'drizzle-orm';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, ENV, type Db, type Env } from '../core/tokens.js';

/** Keeps a single export response bounded; older rows stay available via backups. */
const EXPORT_ROW_LIMIT = 1000;

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

    // Session summaries only — prompts, completions and event payloads stay out of exports.
    const sessions = await this.db
      .select({
        id: runtimeSessions.id,
        agentId: runtimeSessions.agentId,
        versionId: runtimeSessions.versionId,
        publicationId: runtimeSessions.publicationId,
        runtimeProvider: runtimeSessions.runtimeProvider,
        status: runtimeSessions.status,
        createdAt: runtimeSessions.createdAt,
        endedAt: runtimeSessions.endedAt,
      })
      .from(runtimeSessions)
      .where(eq(runtimeSessions.organizationId, ctx.organizationId))
      .orderBy(desc(runtimeSessions.createdAt))
      .limit(EXPORT_ROW_LIMIT);

    const [usageTotals] = await this.db
      .select({
        recordCount: sql<number>`count(*)::int`,
        inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
        toolCallCount: sql<number>`coalesce(sum(${usageRecords.toolCallCount}), 0)::int`,
        estimatedCostUsd: sql<string>`coalesce(sum(${usageRecords.estimatedCostUsd}::numeric), 0)::text`,
      })
      .from(usageRecords)
      .where(eq(usageRecords.organizationId, ctx.organizationId));

    const usageByMonth = await this.db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${usageRecords.createdAt}), 'YYYY-MM')`,
        inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
        toolCallCount: sql<number>`coalesce(sum(${usageRecords.toolCallCount}), 0)::int`,
        estimatedCostUsd: sql<string>`coalesce(sum(${usageRecords.estimatedCostUsd}::numeric), 0)::text`,
      })
      .from(usageRecords)
      .where(eq(usageRecords.organizationId, ctx.organizationId))
      .groupBy(sql`date_trunc('month', ${usageRecords.createdAt})`)
      .orderBy(sql`date_trunc('month', ${usageRecords.createdAt}) desc`);

    // Audit summaries carry no metadata: metadata can reference resource names and payload hints.
    const audit = await this.db
      .select({
        action: auditEvents.action,
        resourceType: auditEvents.resourceType,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, ctx.organizationId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(EXPORT_ROW_LIMIT);

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'org.exported',
      resourceType: 'organization',
      resourceId: ctx.organizationId,
      metadata: {
        memberCount: members.length,
        agentCount: agents.length,
        sessionCount: sessions.length,
        auditEventCount: audit.length,
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      rowLimit: EXPORT_ROW_LIMIT,
      organization: org
        ? { id: org.id, name: org.name, slug: org.slug, createdAt: org.createdAt }
        : null,
      retentionDays: await this.getRetentionDays(ctx.organizationId),
      members,
      agents,
      sessions,
      usage: {
        totals: usageTotals ?? {
          recordCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          toolCallCount: 0,
          estimatedCostUsd: '0',
        },
        byMonth: usageByMonth,
      },
      auditEvents: audit,
    };
  }

  /**
   * Right-to-erasure. Every org-scoped table declares `organization_id ... on delete cascade`,
   * so deleting the organization row removes agents, versions, publications, tokens, invites,
   * settings, secrets and runtime telemetry in one transaction. `audit_events.organization_id`
   * is `on delete set null` by design: the immutable trail survives the tenant.
   */
  async eraseOrganization(ctx: RequestContext, confirmSlug: string) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1);
    if (!org) throw new NotFoundException('Organization not found');
    if (confirmSlug !== org.slug) {
      throw new BadRequestException('confirmSlug must match the organization slug');
    }

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'org.erased',
      resourceType: 'organization',
      resourceId: ctx.organizationId,
      metadata: { organizationId: org.id, organizationSlug: org.slug, name: org.name },
    });

    await this.db.delete(organizations).where(eq(organizations.id, ctx.organizationId));

    return {
      erased: true,
      organizationId: org.id,
      slug: org.slug,
      erasedAt: new Date().toISOString(),
    };
  }
}
