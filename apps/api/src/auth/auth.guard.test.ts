import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from './auth.guard.js';
import type { RequestContext } from './auth.types.js';
import type { Auth, Db, Env } from '../core/tokens.js';

type Row = Record<string, unknown>;

/** Drizzle select chains always terminate in `.limit()` inside the guard. */
function fakeDb(selectResults: Row[][]) {
  const queue = [...selectResults];
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(queue.shift() ?? []),
  };
  return {
    select: () => chain,
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
  } as unknown as Db;
}

function fakeAuth(user: Row | null) {
  return {
    api: { getSession: vi.fn(async () => (user ? { user } : null)) },
  } as unknown as Auth;
}

function fakeEnv(overrides: Partial<Env> = {}) {
  return { REQUIRE_MFA_FOR_PRIVILEGED: false, ...overrides } as Env;
}

function contextFor(headers: Record<string, string>) {
  const req: { headers: Record<string, string>; authContext?: RequestContext } = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AuthGuard', () => {
  it('rejects requests without an organization header', async () => {
    const guard = new AuthGuard(fakeAuth(null), fakeDb([]), fakeEnv());
    const { ctx } = contextFor({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('publication tokens', () => {
    const headers = { 'x-organization-id': 'org_1', 'x-publication-token': 'pub_live_token' };

    it('binds the request to the token publication with the end_user role', async () => {
      const db = fakeDb([[{ id: 'ptok_1', publicationId: 'pub_1', expiresAt: null }]]);
      const guard = new AuthGuard(fakeAuth(null), db, fakeEnv());
      const { ctx, req } = contextFor(headers);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(req.authContext).toMatchObject({
        organizationId: 'org_1',
        roleKey: 'end_user',
        publicationId: 'pub_1',
        authMode: 'publication_token',
      });
    });

    it('never escalates a token beyond end_user, so MCP-capable permissions stay unreachable', async () => {
      const db = fakeDb([[{ id: 'ptok_1', publicationId: 'pub_1', expiresAt: null }]]);
      const guard = new AuthGuard(fakeAuth(null), db, fakeEnv());
      const { ctx, req } = contextFor(headers);

      await guard.canActivate(ctx);
      // `governance:manage` (the MCP call permission) is not granted to end_user.
      expect(req.authContext?.roleKey).toBe('end_user');
      expect(req.authContext?.user.id).toBe('pubtoken:ptok_1');
    });

    it('rejects an unknown token', async () => {
      const guard = new AuthGuard(fakeAuth(null), fakeDb([[]]), fakeEnv());
      const { ctx } = contextFor(headers);
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      const db = fakeDb([
        [{ id: 'ptok_1', publicationId: 'pub_1', expiresAt: new Date(Date.now() - 1000) }],
      ]);
      const guard = new AuthGuard(fakeAuth(null), db, fakeEnv());
      const { ctx } = contextFor(headers);
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a bearer-style publication token', async () => {
      const db = fakeDb([[{ id: 'ptok_2', publicationId: 'pub_2', expiresAt: null }]]);
      const guard = new AuthGuard(fakeAuth(null), db, fakeEnv());
      const { ctx, req } = contextFor({
        'x-organization-id': 'org_1',
        authorization: 'Bearer pub_live_token',
      });

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(req.authContext?.publicationId).toBe('pub_2');
    });
  });

  describe('session auth', () => {
    const headers = { 'x-organization-id': 'org_1', cookie: 'session=abc' };

    it('rejects a user without a membership in the organization', async () => {
      const guard = new AuthGuard(fakeAuth({ id: 'u1' }), fakeDb([[]]), fakeEnv());
      const { ctx } = contextFor(headers);
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('allows a privileged role without MFA when the gate is off', async () => {
      const db = fakeDb([[{ roleKey: 'org_admin' }]]);
      const guard = new AuthGuard(fakeAuth({ id: 'u1' }), db, fakeEnv());
      const { ctx, req } = contextFor(headers);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(req.authContext?.roleKey).toBe('org_admin');
    });

    it('blocks a privileged role without MFA when the gate is on', async () => {
      const db = fakeDb([[{ roleKey: 'agent_approver' }]]);
      const guard = new AuthGuard(
        fakeAuth({ id: 'u1', twoFactorEnabled: false }),
        db,
        fakeEnv({ REQUIRE_MFA_FOR_PRIVILEGED: true }),
      );
      const { ctx } = contextFor(headers);
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a privileged role with MFA enrolled when the gate is on', async () => {
      const db = fakeDb([[{ roleKey: 'org_owner' }]]);
      const guard = new AuthGuard(
        fakeAuth({ id: 'u1', twoFactorEnabled: true }),
        db,
        fakeEnv({ REQUIRE_MFA_FOR_PRIVILEGED: true }),
      );
      const { ctx } = contextFor(headers);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('leaves unprivileged roles alone when the gate is on', async () => {
      const db = fakeDb([[{ roleKey: 'agent_creator' }]]);
      const guard = new AuthGuard(
        fakeAuth({ id: 'u1', twoFactorEnabled: false }),
        db,
        fakeEnv({ REQUIRE_MFA_FOR_PRIVILEGED: true }),
      );
      const { ctx } = contextFor(headers);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });
});
