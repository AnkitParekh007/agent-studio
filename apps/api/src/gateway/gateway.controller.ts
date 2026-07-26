import { Body, Controller, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { GatewayService } from './gateway.service.js';

@Controller('api/gateway')
@UseGuards(AuthGuard, PermissionsGuard)
export class GatewayController {
  constructor(@Inject(GatewayService) private readonly gateway: GatewayService) {}

  @Post('sessions')
  @RequirePermissions('session:start')
  start(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        publicationId: z.string().min(1),
        message: z.string().optional(),
      })
      .parse(body);
    return this.gateway.startSession(ctx, input);
  }

  @Post('sessions/:sessionId/messages')
  @RequirePermissions('session:start')
  message(
    @AuthCtx() ctx: RequestContext,
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    const input = z.object({ text: z.string().min(1) }).parse(body);
    return this.gateway.submitInput(ctx, sessionId, input.text);
  }

  @Post('sessions/:sessionId/cancel')
  @RequirePermissions('session:start')
  cancel(@AuthCtx() ctx: RequestContext, @Param('sessionId') sessionId: string) {
    return this.gateway.cancel(ctx, sessionId);
  }

  @Post('sessions/:sessionId/stream')
  @RequirePermissions('session:start')
  async stream(
    @AuthCtx() ctx: RequestContext,
    @Param('sessionId') sessionId: string,
    @Req() _req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.gateway.stream(ctx, sessionId, reply);
  }
}
