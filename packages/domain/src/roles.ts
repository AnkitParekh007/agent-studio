export const ROLE_KEYS = [
  'platform_admin',
  'org_owner',
  'org_admin',
  'agent_creator',
  'agent_approver',
  'agent_operator',
  'end_user',
  'auditor',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSIONS = [
  'org:read',
  'org:manage',
  'agent:read',
  'agent:write',
  'agent:submit',
  'agent:approve',
  'agent:deploy',
  'agent:operate',
  'application:publish',
  'session:start',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  platform_admin: [...PERMISSIONS],
  org_owner: [
    'org:read',
    'org:manage',
    'agent:read',
    'agent:write',
    'agent:submit',
    'agent:approve',
    'agent:deploy',
    'agent:operate',
    'application:publish',
    'session:start',
    'audit:read',
  ],
  org_admin: [
    'org:read',
    'org:manage',
    'agent:read',
    'agent:write',
    'agent:submit',
    'agent:approve',
    'agent:deploy',
    'agent:operate',
    'application:publish',
    'session:start',
    'audit:read',
  ],
  agent_creator: ['org:read', 'agent:read', 'agent:write', 'agent:submit', 'session:start'],
  agent_approver: ['org:read', 'agent:read', 'agent:approve', 'audit:read'],
  agent_operator: [
    'org:read',
    'agent:read',
    'agent:operate',
    'agent:deploy',
    'application:publish',
    'session:start',
  ],
  end_user: ['session:start'],
  auditor: ['org:read', 'agent:read', 'audit:read'],
};
