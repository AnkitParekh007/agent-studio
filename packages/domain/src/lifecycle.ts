export const AGENT_LIFECYCLES = [
  'draft',
  'waiting_for_approval',
  'active',
  'inactive',
  'terminated',
] as const;

export type AgentLifecycle = (typeof AGENT_LIFECYCLES)[number];

const AGENT_TRANSITIONS: Record<AgentLifecycle, AgentLifecycle[]> = {
  draft: ['waiting_for_approval', 'terminated'],
  waiting_for_approval: ['active', 'draft', 'terminated'],
  active: ['inactive', 'waiting_for_approval', 'terminated'],
  inactive: ['active', 'terminated'],
  terminated: [],
};

export function canTransitionAgentLifecycle(from: AgentLifecycle, to: AgentLifecycle): boolean {
  return AGENT_TRANSITIONS[from].includes(to);
}

export function assertAgentLifecycleTransition(from: AgentLifecycle, to: AgentLifecycle): void {
  if (!canTransitionAgentLifecycle(from, to)) {
    throw new Error(`Invalid agent lifecycle transition: ${from} → ${to}`);
  }
}

export const VERSION_STATUSES = [
  'draft',
  'waiting_for_approval',
  'approved',
  'rejected',
  'superseded',
  'archived',
] as const;

export type VersionStatus = (typeof VERSION_STATUSES)[number];

const VERSION_TRANSITIONS: Record<VersionStatus, VersionStatus[]> = {
  draft: ['waiting_for_approval', 'archived'],
  waiting_for_approval: ['approved', 'rejected', 'draft'],
  approved: ['superseded', 'archived'],
  rejected: ['archived', 'draft'],
  superseded: ['archived'],
  archived: [],
};

export function canTransitionVersionStatus(from: VersionStatus, to: VersionStatus): boolean {
  return VERSION_TRANSITIONS[from].includes(to);
}

export function assertVersionStatusTransition(from: VersionStatus, to: VersionStatus): void {
  if (!canTransitionVersionStatus(from, to)) {
    throw new Error(`Invalid version status transition: ${from} → ${to}`);
  }
}
