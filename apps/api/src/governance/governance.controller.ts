import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { EvalsService } from './evals.service.js';
import { GovernanceService } from './governance.service.js';

@Controller()
export class GovernanceController {
  constructor(
    @Inject(GovernanceService) private readonly governance: GovernanceService,
    @Inject(EvalsService) private readonly evals: EvalsService,
  ) {}

  @Get('api/skills')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('governance:manage')
  listSkills(@AuthCtx() ctx: RequestContext) {
    return this.governance.listSkills(ctx.organizationId);
  }

  @Post('api/skills')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('governance:manage')
  createSkill(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        key: z.string().min(1).regex(/^[a-z0-9-]+$/),
        name: z.string().min(1),
        description: z.string().optional(),
        promptFragment: z.string().optional(),
        toolNames: z.array(z.string()).optional(),
      })
      .parse(body);
    return this.governance.createSkill(ctx, input);
  }

  @Get('api/mcp-servers')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('governance:manage')
  listMcp(@AuthCtx() ctx: RequestContext) {
    return this.governance.listMcpServers(ctx.organizationId);
  }

  @Post('api/mcp-servers')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('governance:manage')
  createMcp(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        key: z.string().min(1).regex(/^[a-z0-9-]+$/),
        name: z.string().min(1),
        description: z.string().optional(),
        transport: z.string().optional(),
        endpointUrl: z.string().url(),
        secretReferenceId: z.string().nullable().optional(),
      })
      .parse(body);
    return this.governance.createMcpServer(ctx, input);
  }

  @Get('api/knowledge-sources')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('governance:manage')
  listKnowledge(@AuthCtx() ctx: RequestContext) {
    return this.governance.listKnowledgeSources(ctx.organizationId);
  }

  @Post('api/knowledge-sources')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('governance:manage')
  createKnowledge(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        key: z.string().min(1).regex(/^[a-z0-9-]+$/),
        name: z.string().min(1),
        description: z.string().optional(),
        sourceType: z.string().optional(),
        uri: z.string().min(1),
      })
      .parse(body);
    return this.governance.createKnowledgeSource(ctx, input);
  }

  @Get('api/eval-suites')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('eval:run')
  listSuites(@AuthCtx() ctx: RequestContext) {
    return this.evals.listSuites(ctx.organizationId);
  }

  @Post('api/eval-suites')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('eval:run')
  createSuite(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        agentId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        cases: z
          .array(
            z.object({
              name: z.string().min(1),
              prompt: z.string().min(1),
              expectContains: z.string().optional(),
            }),
          )
          .optional(),
      })
      .parse(body);
    return this.evals.createSuite(ctx, input);
  }

  @Get('api/eval-suites/:suiteId')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('eval:run')
  getSuite(@AuthCtx() ctx: RequestContext, @Param('suiteId') suiteId: string) {
    return this.evals.getSuite(ctx.organizationId, suiteId);
  }

  @Post('api/eval-suites/:suiteId/run')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('eval:run')
  runSuite(
    @AuthCtx() ctx: RequestContext,
    @Param('suiteId') suiteId: string,
    @Body() body: unknown,
  ) {
    const input = z.object({ versionId: z.string().optional() }).parse(body ?? {});
    return this.evals.runSuite(ctx, suiteId, input.versionId);
  }

  @Get('api/eval-runs')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('eval:run')
  listRuns(@AuthCtx() ctx: RequestContext) {
    return this.evals.listRuns(ctx.organizationId);
  }

  @Get('api/eval-runs/:runId')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('eval:run')
  getRun(@AuthCtx() ctx: RequestContext, @Param('runId') runId: string) {
    return this.evals.getRun(ctx.organizationId, runId);
  }
}
