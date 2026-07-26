import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { GatewayService } from '../gateway/gateway.service.js';

/**
 * Stable public API surface for the `api` and `embed` publication channels.
 * Auth: Better Auth session cookie OR `x-publication-token` / Bearer `pub_…`.
 */
@Controller('api/v1')
export class PublicApiController {
  constructor(@Inject(GatewayService) private readonly gateway: GatewayService) {}

  @Get()
  docs() {
    return {
      name: 'Agent Studio Public API',
      version: 'v1',
      auth: {
        publicationToken: 'Header x-publication-token: pub_… (or Authorization: Bearer pub_…)',
        sessionCookie: 'Better Auth cookie + x-organization-id',
      },
      endpoints: {
        'POST /api/v1/sessions': {
          body: { publicationId: 'string', message: 'string?' },
          permission: 'session:start',
        },
        'POST /api/v1/sessions/:sessionId/messages': {
          body: { text: 'string' },
        },
        'POST /api/v1/sessions/:sessionId/stream': {
          response: 'text/event-stream',
        },
        'POST /api/v1/sessions/:sessionId/cancel': {},
        'GET /api/public/apps/:orgSlug/:appSlug?channel=api|embed|hosted_web|desktop': {
          auth: 'none',
        },
      },
    };
  }

  @Post('sessions')
  @UseGuards(AuthGuard, PermissionsGuard)
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
  @UseGuards(AuthGuard, PermissionsGuard)
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
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('session:start')
  cancel(@AuthCtx() ctx: RequestContext, @Param('sessionId') sessionId: string) {
    return this.gateway.cancel(ctx, sessionId);
  }

  @Post('sessions/:sessionId/stream')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('session:start')
  async stream(
    @AuthCtx() ctx: RequestContext,
    @Param('sessionId') sessionId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.gateway.stream(ctx, sessionId, reply, req);
  }
}
