import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { AgentsService } from './agents.service.js';

const createSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  workspaceId: z.string().optional(),
});

const updateDraftSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

@Controller('api/agents')
@UseGuards(AuthGuard, PermissionsGuard)
export class AgentsController {
  constructor(@Inject(AgentsService) private readonly agents: AgentsService) {}

  @Get()
  @RequirePermissions('agent:read')
  list(@AuthCtx() ctx: RequestContext) {
    return this.agents.list(ctx.organizationId);
  }

  @Post()
  @RequirePermissions('agent:write')
  create(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = createSchema.parse(body);
    return this.agents.create(ctx, input);
  }

  @Get(':agentId')
  @RequirePermissions('agent:read')
  get(@AuthCtx() ctx: RequestContext, @Param('agentId') agentId: string) {
    return this.agents.get(ctx.organizationId, agentId);
  }

  @Get(':agentId/versions')
  @RequirePermissions('agent:read')
  versions(@AuthCtx() ctx: RequestContext, @Param('agentId') agentId: string) {
    return this.agents.listVersions(ctx.organizationId, agentId);
  }

  @Get(':agentId/versions/:versionId')
  @RequirePermissions('agent:read')
  version(
    @AuthCtx() ctx: RequestContext,
    @Param('versionId') versionId: string,
  ) {
    return this.agents.getVersion(ctx.organizationId, versionId);
  }

  @Patch(':agentId/draft')
  @RequirePermissions('agent:write')
  updateDraft(
    @AuthCtx() ctx: RequestContext,
    @Param('agentId') agentId: string,
    @Body() body: unknown,
  ) {
    const input = updateDraftSchema.parse(body);
    return this.agents.updateDraft(ctx, agentId, input as never);
  }

  @Post(':agentId/draft/ensure')
  @RequirePermissions('agent:write')
  ensureDraft(@AuthCtx() ctx: RequestContext, @Param('agentId') agentId: string) {
    return this.agents.ensureEditableDraft(ctx, agentId);
  }

  @Post(':agentId/versions/:versionId/validate')
  @RequirePermissions('agent:write')
  validate(
    @AuthCtx() ctx: RequestContext,
    @Param('versionId') versionId: string,
  ) {
    return this.agents.validateVersion(ctx.organizationId, versionId);
  }
}
