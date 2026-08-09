import type { VersionStatus } from './lifecycle.js';
import type { PublicationChannel } from './publication-channels.js';

export const PROVISIONING_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'superseded',
] as const;

export type ProvisioningStatus = (typeof PROVISIONING_STATUSES)[number];

const PROVISIONING_TRANSITIONS: Record<ProvisioningStatus, ProvisioningStatus[]> = {
  queued: ['running', 'cancelled', 'superseded'],
  running: ['succeeded', 'failed', 'cancelled', 'superseded'],
  succeeded: ['superseded'],
  failed: ['queued', 'cancelled', 'superseded'],
  cancelled: [],
  superseded: [],
};

export function canTransitionProvisioning(
  from: ProvisioningStatus,
  to: ProvisioningStatus,
): boolean {
  return PROVISIONING_TRANSITIONS[from].includes(to);
}

export function assertProvisioningTransition(
  from: ProvisioningStatus,
  to: ProvisioningStatus,
): void {
  if (!canTransitionProvisioning(from, to)) {
    throw new Error(`Invalid provisioning transition: ${from} → ${to}`);
  }
}

export interface RunnableVersionPolicyInput {
  requestedVersionId: string;
  requestedVersionStatus: VersionStatus;
  currentApprovedVersionId: string | null;
  agentTerminated?: boolean;
}

/**
 * Runtime sessions may only bind to the current approved immutable version.
 * A version that was once approved but has since been superseded is rejected
 * even when a stale client still holds its identifier.
 */
export function assertRunnableVersion(input: RunnableVersionPolicyInput): void {
  if (input.agentTerminated) {
    throw new Error('Agent is terminated and cannot start new runtime sessions');
  }
  if (input.requestedVersionStatus !== 'approved') {
    throw new Error(
      `Agent version ${input.requestedVersionId} is not runnable with status ${input.requestedVersionStatus}`,
    );
  }
  if (!input.currentApprovedVersionId) {
    throw new Error('Agent has no current approved version');
  }
  if (input.requestedVersionId !== input.currentApprovedVersionId) {
    throw new Error(
      `Agent version ${input.requestedVersionId} is stale; current approved version is ${input.currentApprovedVersionId}`,
    );
  }
}

export function createProvisioningIdempotencyKey(input: {
  agentId: string;
  versionId: string;
  channel: PublicationChannel;
}): string {
  return `provision:${input.agentId}:${input.versionId}:${input.channel}`;
}

export interface ProvisioningAttempt {
  idempotencyKey: string;
  attempt: number;
  status: ProvisioningStatus;
  versionId: string;
  channel: PublicationChannel;
}

export function nextProvisioningAttempt(
  previous: ProvisioningAttempt,
): ProvisioningAttempt {
  if (previous.status !== 'failed') {
    throw new Error(`Only failed provisioning can be retried; current status is ${previous.status}`);
  }
  return {
    ...previous,
    attempt: previous.attempt + 1,
    status: 'queued',
  };
}

export interface ProvisioningCallbackClaim {
  idempotencyKey: string;
  attempt: number;
  status: Extract<ProvisioningStatus, 'succeeded' | 'failed'>;
  callbackId: string;
}

/**
 * Validate callback identity/attempt ordering after transport-level signature
 * verification has succeeded. Signature verification belongs at the API edge;
 * this policy prevents replay from stale provisioning attempts.
 */
export function assertProvisioningCallbackClaim(
  active: ProvisioningAttempt,
  claim: ProvisioningCallbackClaim,
): void {
  if (claim.idempotencyKey !== active.idempotencyKey) {
    throw new Error('Provisioning callback idempotency key does not match the active request');
  }
  if (claim.attempt !== active.attempt) {
    throw new Error(
      `Provisioning callback attempt ${claim.attempt} is stale; active attempt is ${active.attempt}`,
    );
  }
  if (active.status !== 'running') {
    throw new Error(`Provisioning callback cannot resolve request in status ${active.status}`);
  }
}

export interface PublicationGrant {
  id: string;
  agentId: string;
  versionId: string;
  channel: PublicationChannel;
  revokedAt?: string | null;
  supersededByGrantId?: string | null;
}

export function isPublicationGrantUsable(input: {
  grant: PublicationGrant;
  currentApprovedVersionId: string | null;
  agentTerminated?: boolean;
}): boolean {
  if (input.agentTerminated) return false;
  if (input.grant.revokedAt) return false;
  if (input.grant.supersededByGrantId) return false;
  if (!input.currentApprovedVersionId) return false;
  return input.grant.versionId === input.currentApprovedVersionId;
}

export function assertPublicationGrantUsable(input: {
  grant: PublicationGrant;
  currentApprovedVersionId: string | null;
  agentTerminated?: boolean;
}): void {
  if (!isPublicationGrantUsable(input)) {
    throw new Error(`Publication grant ${input.grant.id} is revoked, superseded, stale, or inactive`);
  }
}

export interface VersionRecord {
  id: string;
  status: VersionStatus;
}

/**
 * Returns an immutable replacement set where the newly approved version is
 * approved and any previously approved version is superseded.
 */
export function approveAndSupersede(
  versions: readonly VersionRecord[],
  approvedVersionId: string,
): VersionRecord[] {
  const target = versions.find(version => version.id === approvedVersionId);
  if (!target) {
    throw new Error(`Unknown agent version: ${approvedVersionId}`);
  }
  if (target.status !== 'waiting_for_approval') {
    throw new Error(
      `Version ${approvedVersionId} cannot be approved from status ${target.status}`,
    );
  }

  return versions.map(version => {
    if (version.id === approvedVersionId) {
      return { ...version, status: 'approved' };
    }
    if (version.status === 'approved') {
      return { ...version, status: 'superseded' };
    }
    return { ...version };
  });
}
