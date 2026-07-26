import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { corsOriginList } from '@agent-studio/config';
import {
  agentDeployments,
  newId,
  organizationSettings,
  publications,
  runtimeEvents,
  runtimeSessions,
  usageRecords,
} from '@agent-studio/database';
import {
  checkBudgets,
  checkToolPermission,
  redactUnknown,
  sumUsage,
  type AgentVersionConfig,
} from '@agent-studio/domain';
import type { AgentRuntimeEvent } from '@agent-studio/runtime-core';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AgentsService } from '../agents/agents.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { logWarn } from '../core/logger.js';
import { MetricsService } from '../core/metrics.service.js';
import { DB, ENV, RUNTIME_REGISTRY, type Db, type Env, type Registry } from '../core/tokens.js';

@Injectable()
export class GatewayService {
  private readonly rateBuckets = new Map<string, number[]>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(RUNTIME_REGISTRY) private readonly registry: Registry,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async startSession(
    ctx: RequestContext,
    input: { publicationId: string; message?: string },
  ) {
    this.enforceRateLimit(ctx.organizationId);
    await this.enforceConcurrentSessions(ctx.organizationId);
    await this.enforceOrgMonthlySpend(ctx.organizationId);

    if (ctx.authMode === 'publication_token' && ctx.publicationId !== input.publicationId) {
      throw new ForbiddenException('Publication token is not valid for this publication');
    }

    const [publication] = await this.db
      .select()
      .from(publications)
      .where(
        and(
          eq(publications.id, input.publicationId),
          eq(publications.organizationId, ctx.organizationId),
          eq(publications.status, 'active'),
        ),
      )
      .limit(1);
    if (!publication) throw new NotFoundException('Publication not found');
    if (!publication.deploymentId) {
      throw new BadRequestException('Publication has no deployment');
    }

    const [deployment] = await this.db
      .select()
      .from(agentDeployments)
      .where(eq(agentDeployments.id, publication.deploymentId))
      .limit(1);
    if (!deployment || deployment.status !== 'ready') {
      throw new BadRequestException('Deployment is not ready');
    }
    if (!deployment.providerAgentId || !deployment.providerEnvironmentId) {
      throw new BadRequestException('Deployment missing provider resources');
    }

    const version = await this.agents.getVersion(ctx.organizationId, publication.versionId);

    const adapter = this.registry.get(deployment.runtimeProvider as 'local' | 'claude');
    const correlationId = newId('corr');

    const runtimeSession = await adapter.startSession({
      deploymentId: deployment.id,
      providerAgentId: deployment.providerAgentId,
      providerEnvironmentId: deployment.providerEnvironmentId,
      initialMessage: input.message,
      metadata: {
        correlationId,
        publicationId: publication.id,
        toolPermissions: version.config.toolPermissions,
        maxToolCalls: version.config.runtimeLimits.maxToolCalls,
      },
    });

    const sessionId = newId('rsess');
    await this.db.insert(runtimeSessions).values({
      id: sessionId,
      organizationId: ctx.organizationId,
      publicationId: publication.id,
      agentId: publication.agentId,
      versionId: publication.versionId,
      deploymentId: deployment.id,
      userId: ctx.user.id.startsWith('pubtoken:') ? null : ctx.user.id,
      runtimeProvider: deployment.runtimeProvider,
      providerSessionId: runtimeSession.providerSessionId,
      status: 'active',
      correlationId,
    });

    this.metrics.increment('gateway_sessions_started');
    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id.startsWith('pubtoken:') ? null : ctx.user.id,
      action: 'session.started',
      resourceType: 'runtime_session',
      resourceId: sessionId,
      correlationId,
      metadata: {
        publicationId: publication.id,
        runtimeProvider: deployment.runtimeProvider,
        model: version.config.model,
        authMode: ctx.authMode ?? 'session',
      },
    });

    return {
      sessionId,
      providerSessionId: runtimeSession.providerSessionId,
      correlationId,
      runtimeProvider: deployment.runtimeProvider,
    };
  }

  async submitInput(ctx: RequestContext, sessionId: string, text: string) {
    this.enforceRateLimit(ctx.organizationId);
    const session = await this.getSession(ctx.organizationId, sessionId);
    this.assertSessionNotTimedOut(session.createdAt);
    if (!session.providerSessionId) throw new BadRequestException('Session missing provider id');
    const adapter = this.registry.get(session.runtimeProvider as 'local' | 'claude');
    await adapter.submitSessionInput({
      providerSessionId: session.providerSessionId,
      text,
    });
    return { ok: true };
  }

  async cancel(ctx: RequestContext, sessionId: string) {
    const session = await this.getSession(ctx.organizationId, sessionId);
    if (!session.providerSessionId) throw new BadRequestException('Session missing provider id');
    const adapter = this.registry.get(session.runtimeProvider as 'local' | 'claude');
    await adapter.cancelSession(session.providerSessionId);
    await this.db
      .update(runtimeSessions)
      .set({ status: 'cancelled', endedAt: new Date(), updatedAt: new Date() })
      .where(eq(runtimeSessions.id, sessionId));
    this.metrics.increment('gateway_sessions_cancelled');
    return { ok: true };
  }

  async stream(
    ctx: RequestContext,
    sessionId: string,
    reply: FastifyReply,
    req?: FastifyRequest,
  ) {
    const allowed = corsOriginList(this.env);
    const originHeader = typeof req?.headers.origin === 'string' ? req.headers.origin : undefined;
    const corsOrigin =
      originHeader && allowed.includes(originHeader) ? originHeader : allowed[0] ?? '';

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...(corsOrigin
        ? {
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Credentials': 'true',
            Vary: 'Origin',
          }
        : {}),
    });

    try {
      for await (const event of this.iterateSessionEvents(ctx, sessionId)) {
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(redactUnknown(event))}\n\n`);
        if (event.type === 'session.ended' || event.type === 'error') break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stream failed';
      logWarn('gateway_stream_error', {
        organizationId: ctx.organizationId,
        sessionId,
        message,
      });
      reply.raw.write(`event: error\n`);
      reply.raw.write(`data: ${JSON.stringify({ message })}\n\n`);
    } finally {
      reply.raw.end();
    }
  }

  async drainStream(ctx: RequestContext, sessionId: string): Promise<AgentRuntimeEvent[]> {
    const events: AgentRuntimeEvent[] = [];
    for await (const event of this.iterateSessionEvents(ctx, sessionId)) {
      events.push(event);
      if (event.type === 'session.ended' || event.type === 'error') break;
    }
    return events;
  }

  private async *iterateSessionEvents(ctx: RequestContext, sessionId: string) {
    const session = await this.getSession(ctx.organizationId, sessionId);
    this.assertSessionNotTimedOut(session.createdAt);
    if (!session.providerSessionId) throw new BadRequestException('Session missing provider id');
    const adapter = this.registry.get(session.runtimeProvider as 'local' | 'claude');
    const version = await this.agents.getVersion(ctx.organizationId, session.versionId);

    for await (const event of adapter.streamSessionEvents({
      providerSessionId: session.providerSessionId,
    })) {
      if (Date.now() - session.createdAt.getTime() > this.env.GATEWAY_SESSION_TIMEOUT_MS) {
        const timeout: AgentRuntimeEvent = {
          id: newId('evt'),
          type: 'error',
          sequence: event.sequence + 1,
          timestamp: new Date().toISOString(),
          payload: { message: 'Session timed out', code: 'session_timeout' },
        };
        await this.persistEvent(ctx.organizationId, sessionId, timeout);
        await this.forceEnd(ctx.organizationId, sessionId, session.providerSessionId);
        this.metrics.increment('gateway_session_timeouts');
        yield timeout;
        break;
      }

      const policyEvent = await this.enforceAndPersist(
        ctx,
        sessionId,
        session.providerSessionId,
        version.config,
        event,
      );
      yield policyEvent;
      if (policyEvent.type === 'session.ended' || policyEvent.type === 'error') break;
    }
  }

  private assertSessionNotTimedOut(createdAt: Date) {
    if (Date.now() - createdAt.getTime() > this.env.GATEWAY_SESSION_TIMEOUT_MS) {
      throw new BadRequestException('Session timed out');
    }
  }

  private enforceRateLimit(organizationId: string) {
    const now = Date.now();
    const windowMs = 60_000;
    const limit = this.env.GATEWAY_RATE_LIMIT_PER_MINUTE;
    const prev = this.rateBuckets.get(organizationId) ?? [];
    const recent = prev.filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.metrics.increment('gateway_rate_limited');
      throw new HttpException(
        `Gateway rate limit exceeded (${limit} requests/minute)`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.rateBuckets.set(organizationId, recent);
  }

  private async enforceConcurrentSessions(organizationId: string) {
    const [settings] = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);
    const max =
      settings?.maxConcurrentSessions ?? this.env.GATEWAY_MAX_CONCURRENT_SESSIONS;

    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(runtimeSessions)
      .where(
        and(
          eq(runtimeSessions.organizationId, organizationId),
          eq(runtimeSessions.status, 'active'),
        ),
      );
    if ((row?.count ?? 0) >= max) {
      this.metrics.increment('gateway_concurrency_denied');
      throw new HttpException(
        `Max concurrent sessions reached (${max})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async enforceOrgMonthlySpend(organizationId: string) {
    const [settings] = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);
    if (!settings?.maxUsdMonthly) return;

    const max = Number(settings.maxUsdMonthly);
    if (!Number.isFinite(max)) return;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${usageRecords.estimatedCostUsd}::numeric), 0)::text`,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.organizationId, organizationId),
          gte(usageRecords.createdAt, monthStart),
        ),
      );

    const spent = Number(row?.total ?? 0);
    if (spent >= max) {
      this.metrics.increment('gateway_org_budget_denied');
      throw new ForbiddenException(
        `Organization monthly spend limit reached ($${max.toFixed(2)})`,
      );
    }
  }

  private async enforceAndPersist(
    ctx: RequestContext,
    sessionId: string,
    providerSessionId: string,
    config: AgentVersionConfig,
    event: AgentRuntimeEvent,
  ): Promise<AgentRuntimeEvent> {
    if (event.type === 'tool.started') {
      const usage = await this.sessionUsage(ctx.organizationId, sessionId);
      const toolName = String(event.payload.toolName ?? event.payload.name ?? 'unknown');
      const toolCheck = checkToolPermission(config, toolName, usage.toolCallCount);
      if (!toolCheck.ok) {
        await this.audit.record({
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id.startsWith('pubtoken:') ? null : ctx.user.id,
          action: 'session.policy_denied',
          resourceType: 'runtime_session',
          resourceId: sessionId,
          metadata: { code: toolCheck.code, reason: toolCheck.reason, toolName },
        });
        const denied: AgentRuntimeEvent = {
          ...event,
          type: 'error',
          payload: { message: toolCheck.reason, code: toolCheck.code },
        };
        await this.persistEvent(ctx.organizationId, sessionId, denied);
        await this.forceEnd(ctx.organizationId, sessionId, providerSessionId);
        return denied;
      }
    }

    await this.persistEvent(ctx.organizationId, sessionId, event);

    if (event.type === 'usage') {
      const usage = await this.sessionUsage(ctx.organizationId, sessionId);
      const budgetCheck = checkBudgets(config.budgets, usage);
      if (!budgetCheck.ok) {
        await this.audit.record({
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id.startsWith('pubtoken:') ? null : ctx.user.id,
          action: 'session.budget_exceeded',
          resourceType: 'runtime_session',
          resourceId: sessionId,
          metadata: { code: budgetCheck.code, reason: budgetCheck.reason },
        });
        const denied: AgentRuntimeEvent = {
          id: event.id,
          type: 'error',
          sequence: event.sequence + 1,
          timestamp: new Date().toISOString(),
          payload: { message: budgetCheck.reason, code: budgetCheck.code },
        };
        await this.persistEvent(ctx.organizationId, sessionId, denied);
        await this.forceEnd(ctx.organizationId, sessionId, providerSessionId);
        return denied;
      }
    }

    return event;
  }

  private async forceEnd(
    organizationId: string,
    sessionId: string,
    providerSessionId: string,
  ) {
    const session = await this.getSession(organizationId, sessionId);
    const adapter = this.registry.get(session.runtimeProvider as 'local' | 'claude');
    await adapter.cancelSession(providerSessionId).catch(() => undefined);
    await this.db
      .update(runtimeSessions)
      .set({ status: 'ended', endedAt: new Date(), updatedAt: new Date() })
      .where(eq(runtimeSessions.id, sessionId));
  }

  private async sessionUsage(organizationId: string, sessionId: string) {
    const rows = await this.db
      .select()
      .from(usageRecords)
      .where(
        and(eq(usageRecords.organizationId, organizationId), eq(usageRecords.sessionId, sessionId)),
      );
    return sumUsage(
      rows.map((r) => ({
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        toolCallCount: r.toolCallCount,
        estimatedCostUsd: Number(r.estimatedCostUsd ?? 0),
      })),
    );
  }

  private async getSession(organizationId: string, sessionId: string) {
    const [session] = await this.db
      .select()
      .from(runtimeSessions)
      .where(
        and(eq(runtimeSessions.id, sessionId), eq(runtimeSessions.organizationId, organizationId)),
      )
      .limit(1);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async persistEvent(
    organizationId: string,
    sessionId: string,
    event: AgentRuntimeEvent,
  ) {
    await this.db.insert(runtimeEvents).values({
      id: newId('revt'),
      organizationId,
      sessionId,
      sequence: event.sequence,
      type: event.type,
      payloadJson: JSON.stringify(redactUnknown(event.payload)),
      providerEventId: event.providerEventId,
    });

    if (event.type === 'usage') {
      await this.db.insert(usageRecords).values({
        id: newId('usage'),
        organizationId,
        sessionId,
        inputTokens: Number(event.payload.inputTokens ?? 0),
        outputTokens: Number(event.payload.outputTokens ?? 0),
        toolCallCount: Number(event.payload.toolCallCount ?? 0),
        estimatedCostUsd: String(event.payload.estimatedCostUsd ?? 0),
      });
    }

    if (event.type === 'session.ended') {
      await this.db
        .update(runtimeSessions)
        .set({ status: 'ended', endedAt: new Date(), updatedAt: new Date() })
        .where(eq(runtimeSessions.id, sessionId));
    }
  }
}
