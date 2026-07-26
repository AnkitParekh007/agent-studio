import { API, approveAsApprover, cookieHeader, getSetCookies, json } from './smoke-lib.mjs';

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

  const templates = await json(
    await fetch(`${API}/api/application-templates`, { headers }),
  );
  if (!Array.isArray(templates) || templates.length < 6) {
    throw new Error(`expected 6 templates, got ${templates?.length}`);
  }

  const slug = `studio-${Date.now()}`;
  const agent = await json(
    await fetch(`${API}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Studio Smoke Agent',
        slug,
        description: 'Phase 5 application studio smoke',
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
  for (let i = 0; i < 20; i++) {
    const createRes = await fetch(`${API}/api/applications`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: agent.id,
        name: 'Studio Smoke App',
        slug: `${slug}-app`,
        templateKey: 'customer_support_assistant',
        description: 'Branded support surface',
      }),
    });
    if (createRes.ok) {
      app = await json(createRes);
      break;
    }
    const body = await createRes.text();
    if (!body.includes('approved version')) {
      throw new Error(`create application failed: ${body}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!app) throw new Error('could not create application after approval');

  if (app.templateKey !== 'customer_support_assistant') {
    throw new Error(`unexpected templateKey: ${app.templateKey}`);
  }
  if (app.status !== 'draft') throw new Error(`expected draft, got ${app.status}`);

  const updated = await json(
    await fetch(`${API}/api/applications/${app.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: 'Studio Smoke App Updated',
        studioConfig: {
          welcomeMessage: 'Welcome to the smoke studio app.',
          theme: { primaryColor: '#B45309' },
          featureFlags: { showStarterPrompts: true, showBrandingFooter: true },
          supportContact: 'smoke@example.com',
        },
      }),
    }),
  );
  if (updated.studioConfig.welcomeMessage !== 'Welcome to the smoke studio app.') {
    throw new Error('studio config update did not persist welcome message');
  }

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
  if (!published) throw new Error('publish never succeeded (deployment not ready?)');
  if (published.status !== 'published') throw new Error(`expected published, got ${published.status}`);
  if (!published.hostedPath) throw new Error('missing hostedPath');

  const publicApp = await json(
    await fetch(`${API}/api/public/apps/acme/${slug}-app`),
  );
  if (!publicApp.application?.studioConfig?.featureFlags) {
    throw new Error('public app missing studioConfig feature flags');
  }
  if (publicApp.application.studioConfig.supportContact !== 'smoke@example.com') {
    throw new Error('public app missing support contact from studio config');
  }
  if (publicApp.application.theme?.primaryColor !== '#B45309') {
    throw new Error('public theme primary color mismatch');
  }

  const listed = await json(await fetch(`${API}/api/applications`, { headers }));
  if (!listed.some((row) => row.id === app.id)) {
    throw new Error('created application missing from list');
  }

  console.log('APPLICATION STUDIO SMOKE OK', published.hostedPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
