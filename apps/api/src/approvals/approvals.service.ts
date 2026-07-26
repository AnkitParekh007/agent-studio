import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  agentDefinitions,
  agentVersions,
  approvalDecisions,
  approvalRequests,
  newId,
} from '@agent-studio/database';
import {
  assertAgentLifecycleTransition,
  assertVersionStatusTransition,
  instructionDiff,
} from '@agent-studio/domain';
import { and, desc, eq } from 'drizzle-orm';
import { AgentsService } from '../agents/agents.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, ENV, PROVISION_QUEUE, type Db, type Env, type ProvisionQueue } from '../core/tokens.js';

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(PROVISION_QUEUE) private readonly provisionQueue: ProvisionQueue,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listPending(organizationId: string) {
    return this.db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.organizationId, organizationId),
          eq(approvalRequests.status, 'pending'),
        ),
      )
      .orderBy(desc(approvalRequests.createdAt));
  }

  async get(organizationId: string, requestId: string) {
    const [request] = await this.db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.id, requestId),
          eq(approvalRequests.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!request) throw new NotFoundException('Approval request not found');

    const version = await this.agents.getVersion(organizationId, request.versionId);
    const baseline = request.baselineVersionId
      ? await this.agents.getVersion(organizationId, request.baselineVersionId)
      : null;
    const agent = await this.agents.get(organizationId, request.agentId);

    return {
      request,
      agent,
      version,
      baseline,
      diff: {
        instructions: instructionDiff(
          baseline?.composedInstructions ?? '',
          version.composedInstructions,
        ),
        model: {
          before: baseline?.config.model ?? null,
          after: version.config.model,
        },
        runtimeProvider: {
          before: baseline?.config.runtimeProvider ?? null,
          after: version.config.runtimeProvider,
        },
      },
    };
  }

  async submit(ctx: RequestContext, agentId: string) {
    const agent = await this.agents.get(ctx.organizationId, agentId);
    if (!agent.currentDraftVersionId) {
      throw new BadRequestException('No draft to submit');
    }
    const validation = await this.agents.validateVersion(
      ctx.organizationId,
      agent.currentDraftVersionId,
    );
    if (!validation.ok) {
      throw new BadRequestException({ message: 'Validation failed', errors: validation.errors });
    }

    const version = validation.version;
    if (version.status !== 'draft') {
      throw new BadRequestException('Only draft versions can be submitted');
    }

    assertVersionStatusTransition('draft', 'waiting_for_approval');
    assertAgentLifecycleTransition(
      agent.lifecycleStatus as never,
      agent.lifecycleStatus === 'active' ? 'waiting_for_approval' : 'waiting_for_approval',
    );

    const now = new Date();
    await this.db
      .update(agentVersions)
      .set({ status: 'waiting_for_approval', submittedAt: now, updatedAt: now })
      .where(eq(agentVersions.id, version.id));

    await this.db
      .update(agentDefinitions)
      .set({
        lifecycleStatus:
          agent.lifecycleStatus === 'active' ? 'waiting_for_approval' : 'waiting_for_approval',
        updatedAt: now,
      })
      .where(eq(agentDefinitions.id, agentId));

    const requestId = newId('apr');
    await this.db.insert(approvalRequests).values({
      id: requestId,
      organizationId: ctx.organizationId,
      agentId,
      versionId: version.id,
      status: 'pending',
      submittedByUserId: ctx.user.id,
      baselineVersionId: agent.currentApprovedVersionId,
      createdAt: now,
      updatedAt: now,
    });

    await this.agents.recordTransition({
      organizationId: ctx.organizationId,
      agentId,
      versionId: version.id,
      fromStatus: 'draft',
      toStatus: 'waiting_for_approval',
      actorUserId: ctx.user.id,
      reason: 'submitted',
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'agent.submitted',
      resourceType: 'approval_request',
      resourceId: requestId,
      metadata: { agentId, versionId: version.id },
    });

    return this.get(ctx.organizationId, requestId);
  }

  async decide(
    ctx: RequestContext,
    requestId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    if (decision === 'rejected' && !reason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const detail = await this.get(ctx.organizationId, requestId);
    if (detail.request.status !== 'pending') {
      throw new BadRequestException('Approval request is not pending');
    }

    if (
      !this.env.ALLOW_SELF_APPROVAL &&
      detail.request.submittedByUserId === ctx.user.id
    ) {
      throw new ForbiddenException(
        'Separation of duties: submitter cannot approve or reject their own request',
      );
    }

    const now = new Date();
    const decisionId = newId('apd');
    await this.db.insert(approvalDecisions).values({
      id: decisionId,
      organizationId: ctx.organizationId,
      approvalRequestId: requestId,
      decision,
      reason: reason ?? null,
      decidedByUserId: ctx.user.id,
      createdAt: now,
    });

    await this.db
      .update(approvalRequests)
      .set({ status: decision, updatedAt: now })
      .where(eq(approvalRequests.id, requestId));

    if (decision === 'rejected') {
      assertVersionStatusTransition('waiting_for_approval', 'rejected');
      await this.db
        .update(agentVersions)
        .set({ status: 'rejected', rejectedAt: now, updatedAt: now })
        .where(eq(agentVersions.id, detail.version.id));

      await this.db
        .update(agentDefinitions)
        .set({
          lifecycleStatus: detail.agent.currentApprovedVersionId ? 'active' : 'draft',
          updatedAt: now,
        })
        .where(eq(agentDefinitions.id, detail.agent.id));

      await this.agents.recordTransition({
        organizationId: ctx.organizationId,
        agentId: detail.agent.id,
        versionId: detail.version.id,
        fromStatus: 'waiting_for_approval',
        toStatus: 'rejected',
        actorUserId: ctx.user.id,
        reason,
      });
    } else {
      assertVersionStatusTransition('waiting_for_approval', 'approved');
      if (detail.agent.currentApprovedVersionId) {
        await this.db
          .update(agentVersions)
          .set({ status: 'superseded', updatedAt: now })
          .where(eq(agentVersions.id, detail.agent.currentApprovedVersionId));
        await this.agents.recordTransition({
          organizationId: ctx.organizationId,
          agentId: detail.agent.id,
          versionId: detail.agent.currentApprovedVersionId,
          fromStatus: 'approved',
          toStatus: 'superseded',
          actorUserId: ctx.user.id,
          reason: 'superseded_by_new_approval',
        });
      }

      await this.db
        .update(agentVersions)
        .set({ status: 'approved', approvedAt: now, updatedAt: now })
        .where(eq(agentVersions.id, detail.version.id));

      await this.db
        .update(agentDefinitions)
        .set({
          lifecycleStatus: 'active',
          currentApprovedVersionId: detail.version.id,
          currentDraftVersionId: null,
          updatedAt: now,
        })
        .where(eq(agentDefinitions.id, detail.agent.id));

      await this.agents.recordTransition({
        organizationId: ctx.organizationId,
        agentId: detail.agent.id,
        versionId: detail.version.id,
        fromStatus: 'waiting_for_approval',
        toStatus: 'approved',
        actorUserId: ctx.user.id,
        reason: 'approved',
      });

      await this.provisionQueue.add('provision', {
        organizationId: ctx.organizationId,
        agentId: detail.agent.id,
        versionId: detail.version.id,
        actorUserId: ctx.user.id,
      });
    }

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: `agent.${decision}`,
      resourceType: 'approval_request',
      resourceId: requestId,
      metadata: { reason, versionId: detail.version.id },
    });

    return this.get(ctx.organizationId, requestId);
  }
}
