import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  agentDefinitions,
  agentVersionTransitions,
  agentVersions,
  newId,
  workspaces,
} from '@agent-studio/database';
import {
  agentVersionConfigSchema,
  assertAgentLifecycleTransition,
  assertVersionStatusTransition,
  composeInstructions,
  type AgentVersionConfig,
} from '@agent-studio/domain';
import { and, desc, eq } from 'drizzle-orm';
import { AuditService } from '../core/audit.service.js';
import { DB, type Db } from '../core/tokens.js';
import type { RequestContext } from '../auth/auth.types.js';

@Injectable()
export class AgentsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(organizationId: string) {
    return this.db
      .select()
      .from(agentDefinitions)
      .where(eq(agentDefinitions.organizationId, organizationId))
      .orderBy(desc(agentDefinitions.updatedAt));
  }

  async get(organizationId: string, agentId: string) {
    const [agent] = await this.db
      .select()
      .from(agentDefinitions)
      .where(
        and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.organizationId, organizationId)),
      )
      .limit(1);
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async create(
    ctx: RequestContext,
    input: { name: string; slug: string; description?: string; workspaceId?: string },
  ) {
    const [workspace] = input.workspaceId
      ? await this.db
          .select()
          .from(workspaces)
          .where(
            and(
              eq(workspaces.id, input.workspaceId),
              eq(workspaces.organizationId, ctx.organizationId),
            ),
          )
          .limit(1)
      : await this.db
          .select()
          .from(workspaces)
          .where(eq(workspaces.organizationId, ctx.organizationId))
          .limit(1);

    if (!workspace) throw new BadRequestException('Workspace not found for organization');

    const agentId = newId('agent');
    const versionId = newId('aver');
    const now = new Date();
    const config = agentVersionConfigSchema.parse({});
    const composed = composeInstructions(config);

    await this.db.insert(agentDefinitions).values({
      id: agentId,
      organizationId: ctx.organizationId,
      workspaceId: workspace.id,
      name: input.name,
      slug: input.slug,
      description: input.description ?? '',
      ownerUserId: ctx.user.id,
      lifecycleStatus: 'draft',
      currentDraftVersionId: versionId,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(agentVersions).values({
      id: versionId,
      organizationId: ctx.organizationId,
      agentId,
      versionNumber: 1,
      status: 'draft',
      configJson: JSON.stringify(config),
      composedInstructions: composed,
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    });

    await this.recordTransition({
      organizationId: ctx.organizationId,
      agentId,
      versionId,
      fromStatus: 'none',
      toStatus: 'draft',
      actorUserId: ctx.user.id,
      reason: 'created',
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'agent.created',
      resourceType: 'agent',
      resourceId: agentId,
      metadata: { slug: input.slug },
    });

    return this.get(ctx.organizationId, agentId);
  }

  async getVersion(organizationId: string, versionId: string) {
    const [version] = await this.db
      .select()
      .from(agentVersions)
      .where(and(eq(agentVersions.id, versionId), eq(agentVersions.organizationId, organizationId)))
      .limit(1);
    if (!version) throw new NotFoundException('Version not found');
    return {
      ...version,
      config: JSON.parse(version.configJson) as AgentVersionConfig,
    };
  }

  async listVersions(organizationId: string, agentId: string) {
    await this.get(organizationId, agentId);
    return this.db
      .select()
      .from(agentVersions)
      .where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.organizationId, organizationId)))
      .orderBy(desc(agentVersions.versionNumber));
  }

  async updateDraft(
    ctx: RequestContext,
    agentId: string,
    patch: {
      name?: string;
      description?: string;
      config?: Partial<AgentVersionConfig>;
    },
  ) {
    const agent = await this.get(ctx.organizationId, agentId);
    if (!agent.currentDraftVersionId) {
      throw new BadRequestException('No draft version available');
    }
    const draft = await this.getVersion(ctx.organizationId, agent.currentDraftVersionId);
    if (draft.status !== 'draft') {
      throw new BadRequestException('Current draft is not editable');
    }

    const nextConfig = agentVersionConfigSchema.parse({
      ...draft.config,
      ...patch.config,
      instructions: {
        ...draft.config.instructions,
        ...patch.config?.instructions,
      },
    });
    const composed = composeInstructions(nextConfig);
    const now = new Date();

    await this.db
      .update(agentVersions)
      .set({
        configJson: JSON.stringify(nextConfig),
        composedInstructions: composed,
        optimisticLock: draft.optimisticLock + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(agentVersions.id, draft.id),
          eq(agentVersions.optimisticLock, draft.optimisticLock),
        ),
      );

    if (patch.name || patch.description !== undefined) {
      await this.db
        .update(agentDefinitions)
        .set({
          name: patch.name ?? agent.name,
          description: patch.description ?? agent.description,
          updatedAt: now,
        })
        .where(eq(agentDefinitions.id, agentId));
    }

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'agent.draft.updated',
      resourceType: 'agent_version',
      resourceId: draft.id,
    });

    return this.getVersion(ctx.organizationId, draft.id);
  }

  async validateVersion(organizationId: string, versionId: string) {
    const version = await this.getVersion(organizationId, versionId);
    const config = version.config;
    const errors: string[] = [];
    if (!composeInstructions(config)) errors.push('Instructions are required');
    if (!config.model) errors.push('Model is required');
    if (!config.runtimeProvider) errors.push('Runtime provider is required');
    return { ok: errors.length === 0, errors, version };
  }

  async ensureEditableDraft(ctx: RequestContext, agentId: string) {
    const agent = await this.get(ctx.organizationId, agentId);
    if (agent.currentDraftVersionId) {
      const draft = await this.getVersion(ctx.organizationId, agent.currentDraftVersionId);
      if (draft.status === 'draft') return draft;
    }

    if (!agent.currentApprovedVersionId) {
      throw new BadRequestException('No approved version to revise');
    }
    const approved = await this.getVersion(ctx.organizationId, agent.currentApprovedVersionId);
    const versions = await this.listVersions(ctx.organizationId, agentId);
    const nextNumber = Math.max(...versions.map((v) => v.versionNumber)) + 1;
    const versionId = newId('aver');
    const now = new Date();

    await this.db.insert(agentVersions).values({
      id: versionId,
      organizationId: ctx.organizationId,
      agentId,
      versionNumber: nextNumber,
      status: 'draft',
      configJson: approved.configJson,
      composedInstructions: approved.composedInstructions,
      createdByUserId: ctx.user.id,
      createdAt: now,
      updatedAt: now,
    });

    await this.db
      .update(agentDefinitions)
      .set({ currentDraftVersionId: versionId, updatedAt: now })
      .where(eq(agentDefinitions.id, agentId));

    await this.recordTransition({
      organizationId: ctx.organizationId,
      agentId,
      versionId,
      fromStatus: 'none',
      toStatus: 'draft',
      actorUserId: ctx.user.id,
      reason: 'revision_from_approved',
    });

    return this.getVersion(ctx.organizationId, versionId);
  }

  async recordTransition(input: {
    organizationId: string;
    agentId: string;
    versionId: string;
    fromStatus: string;
    toStatus: string;
    actorUserId: string;
    reason?: string;
  }) {
    if (input.fromStatus !== 'none') {
      assertVersionStatusTransition(
        input.fromStatus as never,
        input.toStatus as never,
      );
    }
    await this.db.insert(agentVersionTransitions).values({
      id: newId('vtr'),
      organizationId: input.organizationId,
      agentId: input.agentId,
      versionId: input.versionId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      reason: input.reason,
    });
  }

  async setLifecycle(
    organizationId: string,
    agentId: string,
    from: string,
    to: string,
  ) {
    assertAgentLifecycleTransition(from as never, to as never);
    await this.db
      .update(agentDefinitions)
      .set({ lifecycleStatus: to, updatedAt: new Date() })
      .where(
        and(eq(agentDefinitions.id, agentId), eq(agentDefinitions.organizationId, organizationId)),
      );
  }
}
