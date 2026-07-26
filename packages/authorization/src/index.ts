import {
  ROLE_PERMISSIONS,
  type Permission,
  type RoleKey,
} from '@agent-studio/domain';

export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function permissionsForRole(role: RoleKey): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: RoleKey, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function assertPermission(role: RoleKey, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
}

export function assertSameOrganization(
  resourceOrganizationId: string,
  actorOrganizationId: string,
): void {
  if (resourceOrganizationId !== actorOrganizationId) {
    throw new AuthorizationError('Cross-organization access denied');
  }
}
