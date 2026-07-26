import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  evalCases,
  evalRuns,
  evalSuites,
  newId,
} from '@agent-studio/database';
import { and, asc, desc, eq } from 'drizzle-orm';
import { AgentsService } from '../agents/agents.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import { AuditService } from '../core/audit.service.js';
import { DB, type Db } from '../core/tokens.js';
import { GatewayService } from '../gateway/gateway.service.js';
import { PlaygroundService } from '../playground/playground.service.js';

type CaseResult = {
  caseId: string;
  name: string;
  passed: boolean;
  expectContains: string;
  responseText: string;
  reason?: string;
};

@Injectable()
export class EvalsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(forwardRef(() => PlaygroundService))
    private readonly playground: PlaygroundService,
    @Inject(GatewayService) private readonly gateway: GatewayService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  listSuites(organizationId: string) {
    return this.db
      .select()
      .from(evalSuites)
      .where(eq(evalSuites.organizationId, organizationId))
      .orderBy(desc(evalSuites.updatedAt));
  }

  async createSuite(
    ctx: RequestContext,
    input: {
      agentId: string;
      name: string;
      description?: string;
      cases?: Array<{ name: string; prompt: string; expectContains?: string }>;
    },
  ) {
    await this.agents.get(ctx.organizationId, input.agentId);
    const suiteId = newId('esuite');
    const now = new Date();
    await this.db.insert(evalSuites).values({
      id: suiteId,
      organizationId: ctx.organizationId,
      agentId: input.agentId,
      name: input.name,
      description: input.description ?? '',
      createdAt: now,
      updatedAt: now,
    });

    for (const [idx, c] of (input.cases ?? []).entries()) {
      await this.db.insert(evalCases).values({
        id: newId('ecase'),
        suiteId,
        name: c.name,
        prompt: c.prompt,
        expectContains: c.expectContains ?? '',
        sortOrder: idx,
      });
    }

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'eval_suite.created',
      resourceType: 'eval_suite',
      resourceId: suiteId,
      metadata: { agentId: input.agentId },
    });

    return this.getSuite(ctx.organizationId, suiteId);
  }

  async getSuite(organizationId: string, suiteId: string) {
    const [suite] = await this.db
      .select()
      .from(evalSuites)
      .where(and(eq(evalSuites.id, suiteId), eq(evalSuites.organizationId, organizationId)))
      .limit(1);
    if (!suite) throw new NotFoundException('Eval suite not found');
    const cases = await this.db
      .select()
      .from(evalCases)
      .where(eq(evalCases.suiteId, suiteId))
      .orderBy(asc(evalCases.sortOrder));
    return { ...suite, cases };
  }

  listRuns(organizationId: string) {
    return this.db
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.organizationId, organizationId))
      .orderBy(desc(evalRuns.createdAt));
  }

  async getRun(organizationId: string, runId: string) {
    const [run] = await this.db
      .select()
      .from(evalRuns)
      .where(and(eq(evalRuns.id, runId), eq(evalRuns.organizationId, organizationId)))
      .limit(1);
    if (!run) throw new NotFoundException('Eval run not found');
    return {
      ...run,
      results: JSON.parse(run.resultsJson || '[]') as CaseResult[],
    };
  }

  async runSuite(ctx: RequestContext, suiteId: string, versionId?: string) {
    const suite = await this.getSuite(ctx.organizationId, suiteId);
    if (!suite.cases.length) throw new BadRequestException('Eval suite has no cases');

    const agent = await this.agents.get(ctx.organizationId, suite.agentId);
    const resolvedVersionId =
      versionId ?? agent.currentApprovedVersionId ?? agent.currentDraftVersionId;
    if (!resolvedVersionId) throw new BadRequestException('Agent has no version to evaluate');

    const runId = newId('erun');
    await this.db.insert(evalRuns).values({
      id: runId,
      organizationId: ctx.organizationId,
      suiteId,
      agentId: suite.agentId,
      versionId: resolvedVersionId,
      triggeredByUserId: ctx.user.id,
      status: 'running',
    });

    const results: CaseResult[] = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const c of suite.cases) {
      try {
        const started = await this.playground.start(ctx, {
          agentId: suite.agentId,
          versionId: resolvedVersionId,
          message: c.prompt,
        });
        const events = await this.gateway.drainStream(ctx, started.sessionId);
        const completed = [...events]
          .reverse()
          .find((e) => e.type === 'message.completed' || e.type === 'message.delta');
        const responseText = String(completed?.payload.text ?? '');
        const expect = c.expectContains.trim().toLowerCase();
        const passed = !expect || responseText.toLowerCase().includes(expect);
        if (passed) passedCount += 1;
        else failedCount += 1;
        results.push({
          caseId: c.id,
          name: c.name,
          passed,
          expectContains: c.expectContains,
          responseText: responseText.slice(0, 2000),
          reason: passed ? undefined : `Expected response to contain "${c.expectContains}"`,
        });
        await this.playground.cancel(ctx, started.sessionId).catch(() => undefined);
      } catch (err) {
        failedCount += 1;
        results.push({
          caseId: c.id,
          name: c.name,
          passed: false,
          expectContains: c.expectContains,
          responseText: '',
          reason: err instanceof Error ? err.message : 'case failed',
        });
      }
    }

    await this.db
      .update(evalRuns)
      .set({
        status: 'completed',
        passedCount,
        failedCount,
        resultsJson: JSON.stringify(results),
        completedAt: new Date(),
      })
      .where(eq(evalRuns.id, runId));

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorUserId: ctx.user.id,
      action: 'eval_suite.ran',
      resourceType: 'eval_run',
      resourceId: runId,
      metadata: { suiteId, passedCount, failedCount },
    });

    return this.getRun(ctx.organizationId, runId);
  }
}
