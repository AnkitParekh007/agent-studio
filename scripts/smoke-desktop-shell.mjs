const API = process.env.API_BASE_URL ?? 'http://localhost:4000';

function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function cookieHeader(cookies) {
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${res.status} ${text}`);
  }
}

async function main() {
  const signIn = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:1420',
    },
    body: JSON.stringify({ email: 'owner@example.com', password: 'Password123!' }),
  });
  const cookies = getSetCookies(signIn);
  if (!signIn.ok) throw new Error(`sign-in failed: ${await signIn.text()}`);
  if (!cookies.length) throw new Error('expected session cookie for desktop keychain storage');

  const me = await json(
    await fetch(`${API}/api/orgs/for-me`, { headers: { cookie: cookieHeader(cookies) } }),
  );
  const orgId = me.organizations?.[0]?.organizationId;
  const orgSlug = me.organizations?.[0]?.slug;
  if (!orgId || !orgSlug) throw new Error('no organization');

  const headers = {
    'content-type': 'application/json',
    cookie: cookieHeader(cookies),
    'x-organization-id': orgId,
    origin: 'http://localhost:1420',
  };

  const slug = `desk-${Date.now()}`;
  const agent = await json(
    await fetch(`${API}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Desktop Smoke Agent',
        slug,
        description: 'Phase 6 desktop shell smoke',
      }),
    }),
  );

  await fetch(`${API}/api/agents/${agent.id}/draft`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      config: {
        runtimeProvider: 'local',
        instructions: { purpose: 'Answer briefly for desktop smoke.' },
        starterPrompts: ['Hello desktop'],
      },
    }),
  });

  const submitted = await json(
    await fetch(`${API}/api/agents/${agent.id}/submit`, {
      method: 'POST',
      headers,
      body: '{}',
    }),
  );
  const decide = await fetch(`${API}/api/approvals/${submitted.request.id}/decide`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ decision: 'approved' }),
  });
  if (!decide.ok) throw new Error(`approve failed: ${await decide.text()}`);

  let app = null;
  for (let i = 0; i < 20; i++) {
    const createRes = await fetch(`${API}/api/applications`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: agent.id,
        name: 'Desktop Smoke App',
        slug: `${slug}-app`,
        templateKey: 'general_assistant',
      }),
    });
    if (createRes.ok) {
      app = await json(createRes);
      break;
    }
    const body = await createRes.text();
    if (!body.includes('approved version')) throw new Error(`create application failed: ${body}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!app) throw new Error('could not create application');

  let published = null;
  for (let i = 0; i < 30; i++) {
    const pubRes = await fetch(`${API}/api/applications/${app.id}/publish`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    if (pubRes.ok) {
      published = await json(pubRes);
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!published?.hostedPath) throw new Error('publish never succeeded');

  const publicApp = await json(
    await fetch(`${API}/api/public/apps/${orgSlug}/${slug}-app`, {
      headers: { origin: 'http://localhost:1420' },
    }),
  );

  const session = await json(
    await fetch(`${API}/api/gateway/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        publicationId: publicApp.publication.id,
        message: 'Hello from desktop shell smoke',
      }),
    }),
  );

  const streamRes = await fetch(`${API}/api/gateway/sessions/${session.sessionId}/stream`, {
    method: 'POST',
    headers: {
      cookie: cookieHeader(cookies),
      'x-organization-id': orgId,
      origin: 'http://localhost:1420',
    },
  });
  const streamText = await streamRes.text();
  if (!streamRes.ok) throw new Error(`stream failed: ${streamText}`);
  if (!streamText.includes('message.delta') && !streamText.includes('message.completed')) {
    throw new Error(`unexpected stream: ${streamText.slice(0, 400)}`);
  }

  console.log('DESKTOP SHELL SMOKE OK', published.hostedPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
