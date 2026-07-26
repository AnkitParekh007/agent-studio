import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { ApprovalsService } from './approvals.service.js';

@Controller('api')
@UseGuards(AuthGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(@Inject(ApprovalsService) private readonly approvals: ApprovalsService) {}

  @Get('approvals/pending')
  @RequirePermissions('agent:approve')
  pending(@AuthCtx() ctx: RequestContext) {
    return this.approvals.listPending(ctx.organizationId);
  }

  @Get('approvals/:requestId')
  @RequirePermissions('agent:approve')
  get(@AuthCtx() ctx: RequestContext, @Param('requestId') requestId: string) {
    return this.approvals.get(ctx.organizationId, requestId);
  }

  @Post('agents/:agentId/submit')
  @RequirePermissions('agent:submit')
  submit(@AuthCtx() ctx: RequestContext, @Param('agentId') agentId: string) {
    return this.approvals.submit(ctx, agentId);
  }

  @Post('approvals/:requestId/decide')
  @RequirePermissions('agent:approve')
  decide(
    @AuthCtx() ctx: RequestContext,
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({
        decision: z.enum(['approved', 'rejected']),
        reason: z.string().optional(),
      })
      .parse(body);
    return this.approvals.decide(ctx, requestId, input.decision, input.reason);
  }
}
