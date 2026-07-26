import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { PlaygroundService } from './playground.service.js';

@Controller('api/playground')
@UseGuards(AuthGuard, PermissionsGuard)
export class PlaygroundController {
  constructor(@Inject(PlaygroundService) private readonly playground: PlaygroundService) {}

  @Post('sessions')
  @RequirePermissions('agent:write')
  start(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        agentId: z.string().min(1),
        versionId: z.string().optional(),
        message: z.string().optional(),
      })
      .parse(body);
    return this.playground.start(ctx, input);
  }

  @Get('sessions/:sessionId')
  @RequirePermissions('agent:read')
  get(@AuthCtx() ctx: RequestContext, @Param('sessionId') sessionId: string) {
    return this.playground.getSession(ctx, sessionId);
  }

  @Post('sessions/:sessionId/messages')
  @RequirePermissions('agent:write')
  message(
    @AuthCtx() ctx: RequestContext,
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    const input = z.object({ text: z.string().min(1) }).parse(body);
    return this.playground.submit(ctx, sessionId, input.text);
  }

  @Post('sessions/:sessionId/cancel')
  @RequirePermissions('agent:write')
  cancel(@AuthCtx() ctx: RequestContext, @Param('sessionId') sessionId: string) {
    return this.playground.cancel(ctx, sessionId);
  }

  @Post('sessions/:sessionId/stream')
  @RequirePermissions('agent:write')
  async stream(
    @AuthCtx() ctx: RequestContext,
    @Param('sessionId') sessionId: string,
    @Req() _req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.playground.stream(ctx, sessionId, reply);
  }
}
