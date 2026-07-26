import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  agentDeployments,
  newId,
  runtimeEvents,
  runtimeSessions,
  usageRecords,
} from '@agent-studio/database';
import {
  appendGovernanceContext,
  composeInstructions,
  type AgentVersionConfig,
} from '@agent-studio/domain';
import { and, asc, desc, eq } from 'drizzle-orm';
import { AgentsService } from '../agents/agents.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, RUNTIME_REGISTRY, type Db, type Registry } from '../core/tokens.js';
import { GatewayService } from '../gateway/gateway.service.js';
import { GovernanceService } from '../governance/governance.service.js';

@Injectable()
export class PlaygroundService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(RUNTIME_REGISTRY) private readonly registry: Registry,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(GatewayService) private readonly gateway: GatewayService,
    @Inject(forwardRef(() => GovernanceService))
    private readonly governance: GovernanceService,
  ) {}

  async start(
    ctx: RequestContext,
    input: {
      agentId: string;
      versionId?: string;
      message?: string;
    },
  ) {
    const agent = await this.agents.get(ctx.organizationId, input.agentId);
    const versionId =
      input.versionId ??
      agent.currentDraftVersionId ??
      agent.currentApprovedVersionId;
    if (!versionId) {
      throw new BadRequestException('Agent has no version to test');
    }

    const version = await this.agents.getVersion(ctx.organizationId, versionId);
    const config = version.config;
    const adapter = this.registry.get(config.runtimeProvider);
    const instructions = await this.composeVersionInstructions(ctx.organizationId, config);

    const validation = await adapter.validateConfiguration({
      name: agent.name,
      model: config.model,
      instructions,
    });
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Version failed runtime validation',
        errors: validation.errors,
      });
    }

    const deployment = await this.resolvePlaygroundDeployment(
      ctx,
      agent.id,
      version.id,
      config,
      instructions,
    );

    if (!deployment.providerAgentId || !deployment.providerEnvironmentId) {
      throw new BadRequestException('Playground deployment missing provider resources');
    }

    const correlationId = newId('corr');
    const runtimeSession = await adapter.startSession({
      deploymentId: deployment.id,
      providerAgentId: deployment.providerAgentId,
      providerEnvironmentId: deployment.providerEnvironmentId,
      initialMessage: input.message,
      metadata: {
        correlationId,
        source: 'playground',
        agentId: agent.id,
        versionId: version.id,
        toolPermissions: config.toolPermissions,
        maxToolCalls: config.runtimeLimits.maxToolCalls,
      },
    });

    const sessionId = newId('rsess');
    await this.db.insert(runtimeSessions).values({
      id: sessionId,
      organizationId: ctx.organizationId,
      publicationId: null,
      agentId: agent.id,
      versionId: version.id,
      deploymentId: deployment.id,
      userId: ctx.user.id,
      runtimeProvider: config.runtimeProvider,
      providerSessionId: runtimeSession.providerSessionId,
      status: 'active',
      correlationId,
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'playground.session.started',
      resourceType: 'runtime_session',
      resourceId: sessionId,
      correlationId,
      metadata: {
        agentId: agent.id,
        versionId: version.id,
        versionStatus: version.status,
        runtimeProvider: config.runtimeProvider,
      },
    });

    return {
      sessionId,
      providerSessionId: runtimeSession.providerSessionId,
      correlationId,
      runtimeProvider: config.runtimeProvider,
      agentId: agent.id,
      versionId: version.id,
      versionStatus: version.status,
      versionNumber: version.versionNumber,
      starterPrompts: config.starterPrompts,
      developmentOnly: config.runtimeProvider === 'local',
    };
  }

  async getSession(ctx: RequestContext, sessionId: string) {
    const [session] = await this.db
      .select()
      .from(runtimeSessions)
      .where(
        and(
          eq(runtimeSessions.id, sessionId),
          eq(runtimeSessions.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    if (!session) throw new NotFoundException('Playground session not found');

    const events = await this.db
      .select()
      .from(runtimeEvents)
      .where(eq(runtimeEvents.sessionId, sessionId))
      .orderBy(asc(runtimeEvents.sequence));

    const usage = await this.db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.sessionId, sessionId))
      .orderBy(desc(usageRecords.createdAt));

    return {
      session,
      events: events.map((e) => ({
        id: e.id,
        sequence: e.sequence,
        type: e.type,
        payload: JSON.parse(e.payloadJson) as Record<string, unknown>,
        createdAt: e.createdAt,
      })),
      usage,
    };
  }

  stream(ctx: RequestContext, sessionId: string, reply: Parameters<GatewayService['stream']>[2]) {
    return this.gateway.stream(ctx, sessionId, reply);
  }

  submit(ctx: RequestContext, sessionId: string, text: string) {
    return this.gateway.submitInput(ctx, sessionId, text);
  }

  cancel(ctx: RequestContext, sessionId: string) {
    return this.gateway.cancel(ctx, sessionId);
  }

  private async composeVersionInstructions(
    organizationId: string,
    config: AgentVersionConfig,
  ) {
    const attachments = await this.governance.resolveAttachments(organizationId, {
      skillIds: config.skillIds,
      mcpServerIds: config.mcpServerIds,
      knowledgeSourceIds: config.knowledgeSourceIds,
    });
    return appendGovernanceContext(composeInstructions(config), {
      skills: attachments.skills,
      knowledgeSources: attachments.knowledgeSources,
      mcpServers: attachments.mcpServers.map((m) => ({
        name: m.name,
        endpointUrl: m.endpointUrl,
      })),
    });
  }

  private async resolvePlaygroundDeployment(
    ctx: RequestContext,
    agentId: string,
    versionId: string,
    config: AgentVersionConfig,
    instructions: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(agentDeployments)
      .where(
        and(
          eq(agentDeployments.organizationId, ctx.organizationId),
          eq(agentDeployments.versionId, versionId),
          eq(agentDeployments.status, 'ready'),
        ),
      )
      .orderBy(desc(agentDeployments.createdAt))
      .limit(1);

    if (existing?.providerAgentId && existing.providerEnvironmentId) {
      return existing;
    }

    const adapter = this.registry.get(config.runtimeProvider);
    const agent = await this.agents.get(ctx.organizationId, agentId);
    const provisioned = await adapter.provisionDeployment({
      organizationId: ctx.organizationId,
      agentVersionId: versionId,
      configuration: {
        name: `${agent.name} (playground)`,
        model: config.model,
        instructions,
      },
    });

    const deploymentId = newId('dep');
    const now = new Date();
    await this.db.insert(agentDeployments).values({
      id: deploymentId,
      organizationId: ctx.organizationId,
      agentId,
      versionId,
      runtimeProvider: config.runtimeProvider,
      status: 'ready',
      providerAgentId: provisioned.providerAgentId,
      providerEnvironmentId: provisioned.providerEnvironmentId,
      providerDeploymentId: provisioned.id,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await this.db
      .select()
      .from(agentDeployments)
      .where(eq(agentDeployments.id, deploymentId))
      .limit(1);
    if (!created) throw new BadRequestException('Failed to create playground deployment');
    return created;
  }
}
