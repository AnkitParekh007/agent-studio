import type { RoleKey } from '@agent-studio/domain';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type RequestContext = {
  user: AuthUser;
  organizationId: string;
  roleKey: RoleKey;
  authMode?: 'session' | 'publication_token';
  publicationId?: string;
};
