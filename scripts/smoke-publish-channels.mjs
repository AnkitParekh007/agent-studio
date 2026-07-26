import { API, approveAsApprover, json, orgHeaders, signIn } from './smoke-lib.mjs';

async function main() {
  const cookies = await signIn('owner@example.com');
  const headers = await orgHeaders(cookies);

  const slug = `chan-${Date.now()}`;
  const agent = await json(
    await fetch(`${API}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Channel Smoke Agent',
        slug,
        description: 'publish anywhere smoke',
      }),
    }),
  );

  await fetch(`${API}/api/agents/${agent.id}/draft`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      config: {
        runtimeProvider: 'local',
        instructions: { purpose: 'Answer briefly.' },
        starterPrompts: ['Hello'],
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
  await approveAsApprover(submitted.request.id);

  let app = null;
  for (let i = 0; i < 30; i++) {
    const createRes = await fetch(`${API}/api/applications`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: agent.id,
        name: 'Channel Smoke App',
        slug: `${slug}-app`,
        templateKey: 'general_assistant',
      }),
    });
    if (createRes.ok) {
      app = await json(createRes);
      break;
    }
    const body = await createRes.text();
    if (!body.includes('approved version') && !body.includes('ready deployment')) {
      throw new Error(`create application failed: ${body}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!app) throw new Error('application create timed out waiting for provision');

  for (const channel of ['hosted_web', 'embed', 'api', 'desktop']) {
    const pub = await fetch(`${API}/api/applications/${app.id}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel }),
    });
    const body = await json(pub);
    if (!pub.ok) throw new Error(`publish ${channel} failed: ${JSON.stringify(body)}`);
    if (!body.channels?.[channel]?.publicationId) {
      throw new Error(`missing publication for ${channel}`);
    }
  }

  const detail = await json(await fetch(`${API}/api/applications/${app.id}`, { headers }));
  const embedPubId = detail.channels.embed.publicationId;
  const tokenRes = await fetch(`${API}/api/publications/${embedPubId}/tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'smoke-embed', expiresInDays: 1 }),
  });
  const tokenBody = await json(tokenRes);
  if (!tokenRes.ok || !String(tokenBody.token || '').startsWith('pub_')) {
    throw new Error(`token mint failed: ${JSON.stringify(tokenBody)}`);
  }

  const publicEmbed = await json(
    await fetch(`${API}/api/public/apps/acme/${slug}-app?channel=embed`),
  );
  if (publicEmbed.publication?.channel !== 'embed') {
    throw new Error('public embed channel mismatch');
  }

  const session = await json(
    await fetch(`${API}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-organization-id': headers['x-organization-id'],
        'x-publication-token': tokenBody.token,
      },
      body: JSON.stringify({
        publicationId: publicEmbed.publication.id,
        message: 'hello from api channel smoke',
      }),
    }),
  );
  if (!session.sessionId) throw new Error(`v1 session failed: ${JSON.stringify(session)}`);

  const docs = await json(await fetch(`${API}/api/v1`));
  if (!docs.endpoints) throw new Error('missing /api/v1 docs');

  console.log('Publish channels smoke OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
