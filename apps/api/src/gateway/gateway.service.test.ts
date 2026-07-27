import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GatewayService } from './gateway.service.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { Db, Env, Redis, Registry } from '../core/tokens.js';
import type { AgentsService } from '../agents/agents.service.js';
import type { AuditService } from '../core/audit.service.js';
import { MetricsService } from '../core/metrics.service.js';

type Row = Record<string, unknown>;

function fakeDb(session: Row | null) {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    limit: () => Promise.resolve(session ? [session] : []),
  };
  const updated = vi.fn(() => Promise.resolve([{ id: session?.id ?? 'rsess_1' }]));
  return {
    db: {
      select: () => selectChain,
      update: () => ({ set: () => ({ where: () => ({ returning: updated }) }) }),
    } as unknown as Db,
    updated,
  };
}

function fakeRedis(decrResult = 0) {
  return {
    incr: vi.fn(async () => 1),
    decr: vi.fn(async () => decrResult),
    set: vi.fn(async () => 'OK'),
    pexpire: vi.fn(async () => 1),
  } as unknown as Redis & {
    decr: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
}

function buildService(options: { session: Row | null; decrResult?: number }) {
  const { db, updated } = fakeDb(options.session);
  const redis = fakeRedis(options.decrResult ?? 0);
  const cancelSession = vi.fn(async () => undefined);
  const registry = { get: () => ({ cancelSession }) } as unknown as Registry;
  const env = { GATEWAY_SESSION_TIMEOUT_MS: 900_000 } as Env;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;

  const service = new GatewayService(
    db,
    env,
    redis,
    registry,
    {} as AgentsService,
    audit,
    new MetricsService(),
  );

  return { service, redis, cancelSession, updated };
}

const publicationTokenCtx: RequestContext = {
  user: { id: 'pubtoken:ptok_1', email: 'publication-token@runtime.local', name: 'Publication Token' },
  organizationId: 'org_1',
  roleKey: 'end_user',
  publicationId: 'pub_1',
  authMode: 'publication_token',
};

const activeSession = {
  id: 'rsess_1',
  organizationId: 'org_1',
  publicationId: 'pub_1',
  providerSessionId: 'provider_1',
  runtimeProvider: 'local',
  status: 'active',
  createdAt: new Date(),
};

describe('GatewayService session authorization', () => {
  it('denies a publication token acting on another publication session', async () => {
    const { service, cancelSession } = buildService({
      session: { ...activeSession, publicationId: 'pub_other' },
    });

    await expect(service.cancel(publicationTokenCtx, 'rsess_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(cancelSession).not.toHaveBeenCalled();
  });

  it('allows a publication token acting on its own session', async () => {
    const { service, cancelSession } = buildService({ session: activeSession });

    await expect(service.cancel(publicationTokenCtx, 'rsess_1')).resolves.toEqual({ ok: true });
    expect(cancelSession).toHaveBeenCalledWith('provider_1');
  });

  it('reports a missing session rather than leaking cross-org existence', async () => {
    const { service } = buildService({ session: null });

    await expect(service.cancel(publicationTokenCtx, 'rsess_missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('GatewayService concurrency slots', () => {
  it('releases a slot when an active session is closed', async () => {
    const { service, redis, updated } = buildService({ session: activeSession });

    await service.cancel(publicationTokenCtx, 'rsess_1');
    expect(updated).toHaveBeenCalledTimes(1);
    expect(redis.decr).toHaveBeenCalledTimes(1);
  });

  it('does not release a slot when the session was already terminal', async () => {
    const { service, redis, updated } = buildService({ session: activeSession });
    // Simulate the `status = 'active'` predicate matching no rows.
    updated.mockResolvedValueOnce([]);

    await service.cancel(publicationTokenCtx, 'rsess_1');
    expect(redis.decr).not.toHaveBeenCalled();
  });

  it('floors the counter at zero if a decrement underflows', async () => {
    const { service, redis } = buildService({ session: activeSession, decrResult: -1 });

    await service.cancel(publicationTokenCtx, 'rsess_1');
    expect(redis.set).toHaveBeenCalledWith('gateway:concurrency:org_1', '0');
  });
});
