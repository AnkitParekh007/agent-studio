import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { memberships, publicationTokens } from '@agent-studio/database';
import { and, eq, isNull } from 'drizzle-orm';
import { hashToken, type RoleKey } from '@agent-studio/domain';
import { AUTH, DB, type Auth, type Db } from '../core/tokens.js';
import type { RequestContext } from './auth.types.js';

function extractPublicationToken(headers: Record<string, string | string[] | undefined>): string | undefined {
  const dedicated =
    typeof headers['x-publication-token'] === 'string' ? headers['x-publication-token'] : undefined;
  if (dedicated?.startsWith('pub_')) return dedicated;
  const auth = typeof headers.authorization === 'string' ? headers.authorization : undefined;
  if (auth?.toLowerCase().startsWith('bearer pub_')) {
    return auth.slice('bearer '.length).trim();
  }
  return undefined;
}

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

    const organizationId =
      (typeof req.headers['x-organization-id'] === 'string'
        ? req.headers['x-organization-id']
        : undefined) ?? req.query?.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('x-organization-id header is required');
    }

    const publicationToken = extractPublicationToken(req.headers);
    if (publicationToken) {
      const [tokenRow] = await this.db
        .select()
        .from(publicationTokens)
        .where(
          and(
            eq(publicationTokens.tokenHash, hashToken(publicationToken)),
            eq(publicationTokens.organizationId, organizationId),
            isNull(publicationTokens.revokedAt),
          ),
        )
        .limit(1);

      if (!tokenRow) {
        throw new UnauthorizedException('Invalid publication token');
      }
      if (tokenRow.expiresAt && tokenRow.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Publication token expired');
      }

      await this.db
        .update(publicationTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(publicationTokens.id, tokenRow.id));

      req.authContext = {
        user: {
          id: `pubtoken:${tokenRow.id}`,
          email: 'publication-token@runtime.local',
          name: 'Publication Token',
        },
        organizationId,
        roleKey: 'end_user',
        publicationId: tokenRow.publicationId,
        authMode: 'publication_token',
      };
      return true;
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(','));
    }

    const session = await this.auth.api.getSession({ headers });
    if (!session?.user) {
      throw new UnauthorizedException('Authentication required');
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
      authMode: 'session',
    };
    return true;
  }
}
