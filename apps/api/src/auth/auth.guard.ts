import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { memberships } from '@agent-studio/database';
import { and, eq } from 'drizzle-orm';
import type { RoleKey } from '@agent-studio/domain';
import { AUTH, DB, type Auth, type Db } from '../core/tokens.js';
import type { RequestContext } from './auth.types.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      query?: Record<string, string | undefined>;
      authContext?: RequestContext;
    }>();

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(','));
    }

    const session = await this.auth.api.getSession({ headers });
    if (!session?.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const organizationId =
      (typeof req.headers['x-organization-id'] === 'string'
        ? req.headers['x-organization-id']
        : undefined) ?? req.query?.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('x-organization-id header is required');
    }

    const [membership] = await this.db
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.organizationId, organizationId), eq(memberships.userId, session.user.id)),
      )
      .limit(1);

    if (!membership) {
      throw new UnauthorizedException('Not a member of this organization');
    }

    req.authContext = {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      organizationId,
      roleKey: membership.roleKey as RoleKey,
    };
    return true;
  }
}
