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
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ email: 'owner@example.com', password: 'Password123!' }),
  });
  const cookies = getSetCookies(signIn);
  if (!signIn.ok) throw new Error(`sign-in failed: ${await signIn.text()}`);

  const me = await json(
    await fetch(`${API}/api/orgs/for-me`, { headers: { cookie: cookieHeader(cookies) } }),
  );
  const orgId = me.organizations?.[0]?.organizationId;
  if (!orgId) throw new Error('no organization');

  const headers = {
    'content-type': 'application/json',
    cookie: cookieHeader(cookies),
    'x-organization-id': orgId,
  };

  const slug = `pg-${Date.now()}`;
  const agent = await json(
    await fetch(`${API}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Playground Smoke', slug, description: 'Phase 4 smoke' }),
    }),
  );

  await fetch(`${API}/api/agents/${agent.id}/draft`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      config: {
        runtimeProvider: 'local',
        instructions: { purpose: 'Answer briefly in playground.' },
        starterPrompts: ['Ping'],
      },
    }),
  });

  const started = await json(
    await fetch(`${API}/api/playground/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: agent.id,
        versionId: agent.currentDraftVersionId,
        message: 'Playground hello',
      }),
    }),
  );

  const streamRes = await fetch(`${API}/api/playground/sessions/${started.sessionId}/stream`, {
    method: 'POST',
    headers: {
      cookie: cookieHeader(cookies),
      'x-organization-id': orgId,
    },
  });
  const streamText = await streamRes.text();
  if (!streamRes.ok) throw new Error(`stream failed: ${streamText}`);
  if (!streamText.includes('tool.started') || !streamText.includes('message.completed')) {
    throw new Error(`unexpected stream: ${streamText.slice(0, 400)}`);
  }

  const detail = await json(
    await fetch(`${API}/api/playground/sessions/${started.sessionId}`, { headers }),
  );
  if (!detail.events?.length) throw new Error('expected persisted playground events');

  console.log('PLAYGROUND SMOKE OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
