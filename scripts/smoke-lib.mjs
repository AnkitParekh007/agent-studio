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

/** Browser origin Better Auth trusts; must match CORS_ORIGINS / CONTROL_PLANE_ORIGIN. */
export const CONTROL_ORIGIN =
  process.env.CONTROL_PLANE_ORIGIN ?? 'http://localhost:3000';

export async function signIn(email, password = 'Password123!') {
  const res = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: CONTROL_ORIGIN,
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

  // createAndPublish is not idempotent: create succeeds before provision, then publish
  // 400s and retries collide on slug. Create once, then poll channel publish.
  let appId = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const createApp = await fetch(`${API}/api/applications`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: agent.id,
        name: 'Authz Fixture App',
        slug: `${slug}-app`,
        templateKey: 'general_assistant',
      }),
    });
    if (createApp.ok) {
      appId = (await json(createApp)).id;
      break;
    }
    const body = await createApp.text();
    if (!body.includes('approved version')) {
      throw new Error(`fixture app create failed: ${body}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!appId) throw new Error('fixture app create timed out');

  for (let attempt = 0; attempt < 90; attempt++) {
    const publishRes = await fetch(`${API}/api/applications/${appId}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: 'hosted_web' }),
    });
    if (publishRes.ok) {
      const created = await findActivePublication(headers);
      if (created) return created;
    } else {
      const body = await publishRes.text();
      if (!body.includes('ready deployment')) {
        throw new Error(`fixture publish failed: ${body}`);
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
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
