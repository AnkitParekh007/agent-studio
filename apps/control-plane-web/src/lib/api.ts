const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export type OrgRow = {
  organizationId: string;
  name: string;
  slug: string;
  roleKey: string;
};

async function api<T>(
  path: string,
  options: RequestInit & { organizationId?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  if (options.organizationId) {
    headers.set('x-organization-id', options.organizationId);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const client = {
  signIn(email: string, password: string) {
    return api<{ user: { id: string; email: string; name: string } }>('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  meOrgs() {
    return api<{ user: { id: string; email: string; name: string }; organizations: OrgRow[] }>(
      '/api/orgs/for-me',
    );
  },
  listAgents(organizationId: string) {
    return api<Array<Record<string, unknown>>>('/api/agents', { organizationId });
  },
  createAgent(
    organizationId: string,
    body: { name: string; slug: string; description?: string },
  ) {
    return api<Record<string, unknown>>('/api/agents', {
      method: 'POST',
      organizationId,
      body: JSON.stringify(body),
    });
  },
  updateDraft(
    organizationId: string,
    agentId: string,
    body: Record<string, unknown>,
  ) {
    return api<Record<string, unknown>>(`/api/agents/${agentId}/draft`, {
      method: 'PATCH',
      organizationId,
      body: JSON.stringify(body),
    });
  },
  submit(organizationId: string, agentId: string) {
    return api<Record<string, unknown>>(`/api/agents/${agentId}/submit`, {
      method: 'POST',
      organizationId,
    });
  },
  pendingApprovals(organizationId: string) {
    return api<Array<Record<string, unknown>>>('/api/approvals/pending', { organizationId });
  },
  getApproval(organizationId: string, requestId: string) {
    return api<Record<string, unknown>>(`/api/approvals/${requestId}`, { organizationId });
  },
  decide(
    organizationId: string,
    requestId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    return api<Record<string, unknown>>(`/api/approvals/${requestId}/decide`, {
      method: 'POST',
      organizationId,
      body: JSON.stringify({ decision, reason }),
    });
  },
  publish(
    organizationId: string,
    body: { agentId: string; name: string; slug: string; description?: string },
  ) {
    return api<{ path: string; publicationId: string }>('/api/applications/publish', {
      method: 'POST',
      organizationId,
      body: JSON.stringify(body),
    });
  },
};
