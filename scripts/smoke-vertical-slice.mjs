import { API, approveAsApprover, cookieHeader, getSetCookies, json } from './smoke-lib.mjs';

async function main() {
  let cookies = [];

  const signIn = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ email: 'owner@example.com', password: 'Password123!' }),
  });
  cookies = getSetCookies(signIn);
  if (!signIn.ok) throw new Error(`sign-in failed: ${await signIn.text()}`);

  const me = await fetch(`${API}/api/orgs/for-me`, {
    headers: { cookie: cookieHeader(cookies) },
  });
  const meBody = await json(me);
  const orgId = meBody.organizations?.[0]?.organizationId;
  if (!orgId) throw new Error('no organization');

  const headers = {
    'content-type': 'application/json',
    cookie: cookieHeader(cookies),
    'x-organization-id': orgId,
  };

  const slug = `smoke-${Date.now()}`;
  const create = await fetch(`${API}/api/agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Smoke Agent',
      slug,
      description: 'Vertical slice smoke test',
    }),
  });
  const agent = await json(create);
  if (!create.ok) throw new Error(`create agent failed: ${JSON.stringify(agent)}`);

  const draft = await fetch(`${API}/api/agents/${agent.id}/draft`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      config: {
        model: 'local-model',
        runtimeProvider: 'local',
        instructions: { purpose: 'Answer support questions helpfully.' },
        starterPrompts: ['Hello'],
      },
    }),
  });
  if (!draft.ok) throw new Error(`draft update failed: ${await draft.text()}`);

  const submit = await fetch(`${API}/api/agents/${agent.id}/submit`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const submitted = await json(submit);
  if (!submit.ok) throw new Error(`submit failed: ${JSON.stringify(submitted)}`);

  const requestId = submitted.request.id;
  await approveAsApprover(requestId);

  // wait for worker provision
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const appsProbe = await fetch(`${API}/api/applications/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: agent.id,
        name: 'Smoke App',
        slug: `${slug}-app`,
      }),
    });
    if (appsProbe.ok) {
      const published = await json(appsProbe);
      console.log('published', published.path);

      const pub = await fetch(`${API}/api/public/apps/acme/${slug}-app`);
      const publicApp = await json(pub);
      if (!pub.ok) throw new Error(`public app failed: ${JSON.stringify(publicApp)}`);

      const sessionRes = await fetch(`${API}/api/gateway/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          publicationId: publicApp.publication.id,
          message: 'Hello from smoke test',
        }),
      });
      const session = await json(sessionRes);
      if (!sessionRes.ok) throw new Error(`session failed: ${JSON.stringify(session)}`);

      const streamRes = await fetch(`${API}/api/gateway/sessions/${session.sessionId}/stream`, {
        method: 'POST',
        headers: {
          cookie: cookieHeader(cookies),
          'x-organization-id': orgId,
        },
      });
      const streamText = await streamRes.text();
      if (!streamRes.ok) throw new Error(`stream failed: ${streamText}`);
      if (!streamText.includes('message.completed') && !streamText.includes('message.delta')) {
        throw new Error(`unexpected stream payload: ${streamText.slice(0, 500)}`);
      }

      console.log('SMOKE OK');
      ready = true;
      break;
    }
  }

  if (!ready) throw new Error('deployment never became ready for publish');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
