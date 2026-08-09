import { describe, expect, it } from 'vitest';
import {
  approveAndSupersede,
  assertProvisioningCallbackClaim,
  assertProvisioningTransition,
  assertPublicationGrantUsable,
  assertRunnableVersion,
  createProvisioningIdempotencyKey,
  isPublicationGrantUsable,
  nextProvisioningAttempt,
  type ProvisioningAttempt,
  type PublicationGrant,
} from './control-plane-policy.js';

describe('immutable approved versions', () => {
  it('supersedes the previous approved version when a waiting version is approved', () => {
    const result = approveAndSupersede(
      [
        { id: 'v1', status: 'approved' },
        { id: 'v2', status: 'waiting_for_approval' },
        { id: 'v3', status: 'draft' },
      ],
      'v2',
    );

    expect(result).toEqual([
      { id: 'v1', status: 'superseded' },
      { id: 'v2', status: 'approved' },
      { id: 'v3', status: 'draft' },
    ]);
  });

  it('rejects approval from any state other than waiting_for_approval', () => {
    expect(() => approveAndSupersede([{ id: 'v1', status: 'draft' }], 'v1')).toThrow(
      /cannot be approved from status draft/,
    );
  });

  it('rejects stale and rejected versions at runtime', () => {
    expect(() =>
      assertRunnableVersion({
        requestedVersionId: 'v1',
        requestedVersionStatus: 'approved',
        currentApprovedVersionId: 'v2',
      }),
    ).toThrow(/stale/);

    expect(() =>
      assertRunnableVersion({
        requestedVersionId: 'v2',
        requestedVersionStatus: 'rejected',
        currentApprovedVersionId: 'v2',
      }),
    ).toThrow(/not runnable/);
  });
});

describe('provisioning idempotency and retries', () => {
  const failed: ProvisioningAttempt = {
    idempotencyKey: createProvisioningIdempotencyKey({
      agentId: 'agent-1',
      versionId: 'v2',
      channel: 'desktop',
    }),
    attempt: 1,
    status: 'failed',
    versionId: 'v2',
    channel: 'desktop',
  };

  it('uses a stable key for one agent/version/channel publication', () => {
    expect(failed.idempotencyKey).toBe('provision:agent-1:v2:desktop');
  });

  it('requeues failed provisioning as a new attempt without changing the key', () => {
    expect(nextProvisioningAttempt(failed)).toEqual({ ...failed, attempt: 2, status: 'queued' });
  });

  it('does not retry successful or running provisioning implicitly', () => {
    expect(() => nextProvisioningAttempt({ ...failed, status: 'succeeded' })).toThrow(/Only failed/);
  });

  it('allows failed → queued but blocks succeeded → running', () => {
    expect(() => assertProvisioningTransition('failed', 'queued')).not.toThrow();
    expect(() => assertProvisioningTransition('succeeded', 'running')).toThrow(/Invalid provisioning transition/);
  });

  it('rejects replayed callbacks from an older attempt', () => {
    const active = { ...failed, attempt: 2, status: 'running' as const };
    expect(() =>
      assertProvisioningCallbackClaim(active, {
        idempotencyKey: active.idempotencyKey,
        attempt: 1,
        status: 'succeeded',
        callbackId: 'callback-old',
      }),
    ).toThrow(/stale/);
  });

  it('accepts the active callback only after transport signature verification', () => {
    const active = { ...failed, attempt: 2, status: 'running' as const };
    expect(() =>
      assertProvisioningCallbackClaim(active, {
        idempotencyKey: active.idempotencyKey,
        attempt: 2,
        status: 'succeeded',
        callbackId: 'callback-current',
      }),
    ).not.toThrow();
  });
});

describe('publication revocation and superseding', () => {
  const grant: PublicationGrant = {
    id: 'grant-1',
    agentId: 'agent-1',
    versionId: 'v2',
    channel: 'desktop',
  };

  it('allows only the grant for the current approved version', () => {
    expect(isPublicationGrantUsable({ grant, currentApprovedVersionId: 'v2' })).toBe(true);
    expect(isPublicationGrantUsable({ grant, currentApprovedVersionId: 'v3' })).toBe(false);
  });

  it('rejects revoked, superseded, and terminated grants', () => {
    expect(isPublicationGrantUsable({
      grant: { ...grant, revokedAt: '2026-08-09T00:00:00Z' },
      currentApprovedVersionId: 'v2',
    })).toBe(false);

    expect(isPublicationGrantUsable({
      grant: { ...grant, supersededByGrantId: 'grant-2' },
      currentApprovedVersionId: 'v2',
    })).toBe(false);

    expect(() => assertPublicationGrantUsable({
      grant,
      currentApprovedVersionId: 'v2',
      agentTerminated: true,
    })).toThrow(/revoked, superseded, stale, or inactive/);
  });
});
