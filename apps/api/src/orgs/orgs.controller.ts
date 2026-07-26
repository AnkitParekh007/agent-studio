import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { memberships, organizations, workspaces } from '@agent-studio/database';
import { ROLE_KEYS } from '@agent-studio/domain';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { AUTH, DB, type Auth, type Db } from '../core/tokens.js';
import { OrgsService } from './orgs.service.js';

@Controller('api/orgs')
export class OrgsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(OrgsService) private readonly orgs: OrgsService,
  ) {}

  @Get('for-me')
  async forMe(@Req() req: FastifyRequest) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(','));
    }
    const session = await this.auth.api.getSession({ headers });
    if (!session?.user) throw new UnauthorizedException('Authentication required');

    const rows = await this.db
      .select({
        organizationId: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        roleKey: memberships.roleKey,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, session.user.id));

    return {
      user: { id: session.user.id, email: session.user.email, name: session.user.name },
      organizations: rows,
    };
  }

  @Get('current/workspaces')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('org:read')
  async workspaces(@AuthCtx() ctx: RequestContext) {
    return this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.organizationId, ctx.organizationId));
  }

  @Get('current/members')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('org:manage')
  listMembers(@AuthCtx() ctx: RequestContext) {
    return this.orgs.listMembers(ctx.organizationId);
  }

  @Post('current/invites')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('org:manage')
  invite(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        email: z.string().email(),
        roleKey: z.enum(ROLE_KEYS),
      })
      .parse(body);
    return this.orgs.invite(ctx, input);
  }

  @Post('invites/accept')
  async acceptInvite(@Req() req: FastifyRequest, @Body() body: unknown) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(','));
    }
    const session = await this.auth.api.getSession({ headers });
    if (!session?.user) throw new UnauthorizedException('Authentication required');
    const input = z.object({ token: z.string().min(1) }).parse(body);
    return this.orgs.acceptInvite(
      { id: session.user.id, email: session.user.email },
      input.token,
    );
  }

  @Patch('current/members/:userId')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('org:manage')
  updateMember(
    @AuthCtx() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    const input = z.object({ roleKey: z.enum(ROLE_KEYS) }).parse(body);
    return this.orgs.updateMemberRole(ctx, userId, input.roleKey);
  }

  @Get('current/settings')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('org:manage')
  getSettings(@AuthCtx() ctx: RequestContext) {
    return this.orgs.getSettings(ctx.organizationId);
  }

  @Patch('current/settings')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('org:manage')
  updateSettings(@AuthCtx() ctx: RequestContext, @Body() body: unknown) {
    const input = z
      .object({
        maxUsdMonthly: z.string().nullable().optional(),
        maxConcurrentSessions: z.number().int().positive().nullable().optional(),
      })
      .parse(body);
    return this.orgs.upsertSettings(ctx, input);
  }
}
