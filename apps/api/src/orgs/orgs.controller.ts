import {
  Controller,
  Get,
  Inject,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { memberships, organizations, workspaces } from '@agent-studio/database';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { AuthCtx } from '../auth/auth.decorator.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestContext } from '../auth/auth.types.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { AUTH, DB, type Auth, type Db } from '../core/tokens.js';

@Controller('api/orgs')
export class OrgsController {
  constructor(@Inject(DB) private readonly db: Db, @Inject(AUTH) private readonly auth: Auth) {}

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
}
