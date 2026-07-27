export const API = process.env.API_BASE_URL ?? 'http://localhost:4000';

export function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

export function cookieHeader(cookies) {
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

export async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${res.status} ${text}`);
  }
}

export async function signIn(email, password = 'Password123!') {
  const res = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ email, password }),
  });
  const cookies = getSetCookies(res);
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${await res.text()}`);
  return cookies;
}

export async function orgHeaders(cookies) {
  const me = await fetch(`${API}/api/orgs/for-me`, {
    headers: { cookie: cookieHeader(cookies) },
  });
  const meBody = await json(me);
  const orgId = meBody.organizations?.[0]?.organizationId;
  if (!orgId) throw new Error('no organization');
  return {
    'content-type': 'application/json',
    cookie: cookieHeader(cookies),
    'x-organization-id': orgId,
  };
}

/**
 * Runtime the smoke fixtures target. Production stacks refuse the local adapter,
 * so the production CI job sets these to the Claude provider.
 */
export const SMOKE_RUNTIME_PROVIDER = process.env.SMOKE_RUNTIME_PROVIDER ?? 'local';
export const SMOKE_MODEL =
  process.env.SMOKE_MODEL ?? (SMOKE_RUNTIME_PROVIDER === 'claude' ? 'claude-sonnet-4-5' : 'local-model');

async function findActivePublication(headers) {
  const appsRes = await fetch(`${API}/api/applications`, { headers });
  const apps = await json(appsRes);
  if (!appsRes.ok) throw new Error(`apps list failed: ${JSON.stringify(apps)}`);

  for (const app of apps) {
    const detailRes = await fetch(`${API}/api/applications/${app.id}`, { headers });
    const detail = await json(detailRes);
    const publication = detail.publications?.find((p) => p.status === 'active');
    if (publication) return { application: detail, publication };
  }
  return null;
}

/**
 * Returns an application with an active publication, creating one through the real
 * create → submit → approve → provision → publish path when the org has none.
 * Never returns null: callers assert against it instead of skipping.
 */
export async function ensureActivePublication(headers) {
  const existing = await findActivePublication(headers);
  if (existing) return existing;

  const slug = `authz-fixture-${Date.now()}`;
  const createRes = await fetch(`${API}/api/agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Authz Fixture Agent',
      slug,
      description: 'Fixture for negative authorization smoke',
    }),
  });
  const agent = await json(createRes);
  if (!createRes.ok) throw new Error(`fixture agent create failed: ${JSON.stringify(agent)}`);

  const draftRes = await fetch(`${API}/api/agents/${agent.id}/draft`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      config: {
        model: SMOKE_MODEL,
        runtimeProvider: SMOKE_RUNTIME_PROVIDER,
        instructions: { purpose: 'Fixture agent for authorization smoke tests.' },
      },
    }),
  });
  if (!draftRes.ok) throw new Error(`fixture draft failed: ${await draftRes.text()}`);

  const submitRes = await fetch(`${API}/api/agents/${agent.id}/submit`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const submitted = await json(submitRes);
  if (!submitRes.ok) throw new Error(`fixture submit failed: ${JSON.stringify(submitted)}`);
  await approveAsApprover(submitted.request.id);

  // Publishing only succeeds once the worker has provisioned a deployment.
  for (let attempt = 0; attempt < 40; attempt++) {
    const publishRes = await fetch(`${API}/api/applications/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ agentId: agent.id, name: 'Authz Fixture App', slug: `${slug}-app` }),
    });
    if (publishRes.ok) {
      const created = await findActivePublication(headers);
      if (created) return created;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error('fixture publication never became available (deployment not provisioned)');
}

/** Owner submits; dedicated approver decides (SoD). */
export async function approveAsApprover(requestId) {
  const cookies = await signIn('approver@example.com');
  const headers = await orgHeaders(cookies);
  const decide = await fetch(`${API}/api/approvals/${requestId}/decide`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ decision: 'approved' }),
  });
  if (!decide.ok) throw new Error(`approve failed: ${await decide.text()}`);
  return json(decide);
}
