import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  agentDeployments,
  newId,
  publications,
  runtimeEvents,
  runtimeSessions,
  usageRecords,
} from '@agent-studio/database';
import { redactUnknown } from '@agent-studio/domain';
import type { AgentRuntimeEvent } from '@agent-studio/runtime-core';
import { and, eq } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import { AgentsService } from '../agents/agents.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, RUNTIME_REGISTRY, type Db, type Registry } from '../core/tokens.js';

@Injectable()
export class GatewayService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(RUNTIME_REGISTRY) private readonly registry: Registry,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async startSession(
    ctx: RequestContext,
    input: { publicationId: string; message?: string },
  ) {
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
      metadata: { correlationId, publicationId: publication.id },
    });

    const sessionId = newId('rsess');
    await this.db.insert(runtimeSessions).values({
      id: sessionId,
      organizationId: ctx.organizationId,
      publicationId: publication.id,
      agentId: publication.agentId,
      versionId: publication.versionId,
      deploymentId: deployment.id,
      userId: ctx.user.id,
      runtimeProvider: deployment.runtimeProvider,
      providerSessionId: runtimeSession.providerSessionId,
      status: 'active',
      correlationId,
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'session.started',
      resourceType: 'runtime_session',
      resourceId: sessionId,
      correlationId,
      metadata: {
        publicationId: publication.id,
        runtimeProvider: deployment.runtimeProvider,
        model: version.config.model,
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
    const session = await this.getSession(ctx.organizationId, sessionId);
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
    return { ok: true };
  }

  async stream(ctx: RequestContext, sessionId: string, reply: FastifyReply) {
    const session = await this.getSession(ctx.organizationId, sessionId);
    if (!session.providerSessionId) throw new BadRequestException('Session missing provider id');
    const adapter = this.registry.get(session.runtimeProvider as 'local' | 'claude');

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      for await (const event of adapter.streamSessionEvents({
        providerSessionId: session.providerSessionId,
      })) {
        await this.persistEvent(ctx.organizationId, sessionId, event);
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(redactUnknown(event))}\n\n`);
        if (event.type === 'session.ended' || event.type === 'error') break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stream failed';
      reply.raw.write(`event: error\n`);
      reply.raw.write(`data: ${JSON.stringify({ message })}\n\n`);
    } finally {
      reply.raw.end();
    }
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
