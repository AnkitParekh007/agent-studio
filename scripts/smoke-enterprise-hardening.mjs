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

  const secretRes = await fetch(`${API}/api/secrets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `smoke-secret-${Date.now()}`,
      purpose: 'ci',
      value: 'plaintext-never-returned',
    }),
  });
  const secret = await json(secretRes);
  if (!secretRes.ok) throw new Error(`secret create failed: ${JSON.stringify(secret)}`);
  if (secret.value) throw new Error('secret plaintext leaked in create response');

  const listSecrets = await fetch(`${API}/api/secrets`, { headers });
  const secrets = await json(listSecrets);
  if (!listSecrets.ok) throw new Error(`secret list failed: ${JSON.stringify(secrets)}`);
  if (secrets.some((s) => s.value || s.ciphertext)) {
    throw new Error('secret list leaked sensitive fields');
  }

  const members = await fetch(`${API}/api/orgs/current/members`, { headers });
  if (!members.ok) throw new Error(`members list failed: ${await members.text()}`);

  const audit = await fetch(`${API}/api/audit-events?limit=5`, { headers });
  const events = await json(audit);
  if (!audit.ok) throw new Error(`audit list failed: ${JSON.stringify(events)}`);
  if (!Array.isArray(events)) throw new Error('audit list should be an array');

  const metrics = await fetch(`${API}/metrics`);
  const metricsText = await metrics.text();
  if (!metrics.ok || !metricsText.includes('agent_studio_uptime_seconds')) {
    throw new Error(`metrics endpoint failed: ${metrics.status} ${metricsText}`);
  }

  const corr = await fetch(`${API}/health`, {
    headers: { 'x-correlation-id': 'smoke-corr-1' },
  });
  if (corr.headers.get('x-correlation-id') !== 'smoke-corr-1') {
    throw new Error('correlation id not echoed');
  }

  // Find an active publication from prior vertical-slice smoke if present; otherwise skip token path.
  const appsRes = await fetch(`${API}/api/applications`, { headers });
  const apps = await json(appsRes);
  if (!appsRes.ok) throw new Error(`apps list failed: ${JSON.stringify(apps)}`);

  let publicationId = null;
  for (const app of apps) {
    const detailRes = await fetch(`${API}/api/applications/${app.id}`, { headers });
    const detail = await json(detailRes);
    const active = detail.publications?.find((p) => p.status === 'active');
    if (active) {
      publicationId = active.id;
      break;
    }
  }

  if (publicationId) {
    const tokenRes = await fetch(`${API}/api/publications/${publicationId}/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'smoke', expiresInDays: 1 }),
    });
    const tokenBody = await json(tokenRes);
    if (!tokenRes.ok) throw new Error(`publication token create failed: ${JSON.stringify(tokenBody)}`);
    if (!String(tokenBody.token || '').startsWith('pub_')) {
      throw new Error('expected pub_ token');
    }

    const start = await fetch(`${API}/api/gateway/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-organization-id': orgId,
        'x-publication-token': tokenBody.token,
      },
      body: JSON.stringify({ publicationId, message: 'enterprise smoke hello' }),
    });
    const session = await json(start);
    if (!start.ok) throw new Error(`pub-token session failed: ${JSON.stringify(session)}`);

    const revoke = await fetch(`${API}/api/publication-tokens/${tokenBody.id}/revoke`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    if (!revoke.ok) throw new Error(`token revoke failed: ${await revoke.text()}`);
  } else {
    console.log('No active publication yet; skipped publication-token gateway check');
  }

  console.log('Enterprise hardening smoke OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
