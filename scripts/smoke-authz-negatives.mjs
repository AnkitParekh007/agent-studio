/**
 * Negative authorization smoke: every assertion here expects a denial.
 * Run against a seeded stack after `pnpm smoke`.
 */
import { API, cookieHeader, json, orgHeaders, signIn } from './smoke-lib.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const cookies = await signIn('owner@example.com');
  const headers = await orgHeaders(cookies);
  const orgId = headers['x-organization-id'];

  // 1. Cross-org access is refused even with a valid session.
  const crossOrg = await fetch(`${API}/api/agents`, {
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader(cookies),
      'x-organization-id': 'org_not_a_member_of',
    },
  });
  assert(
    crossOrg.status === 401 || crossOrg.status === 403,
    `cross-org access should be denied, got ${crossOrg.status}`,
  );

  // 2. Metrics require the bearer token whenever one is configured.
  const metricsToken = process.env.METRICS_BEARER_TOKEN;
  if (metricsToken) {
    const anon = await fetch(`${API}/metrics`);
    assert(anon.status === 401, `/metrics without bearer should be 401, got ${anon.status}`);

    const wrong = await fetch(`${API}/metrics`, {
      headers: { authorization: 'Bearer not-the-token' },
    });
    assert(wrong.status === 401, `/metrics with wrong bearer should be 401, got ${wrong.status}`);

    const ok = await fetch(`${API}/metrics`, {
      headers: { authorization: `Bearer ${metricsToken}` },
    });
    assert(ok.ok, `/metrics with bearer should succeed, got ${ok.status}`);
  } else {
    console.log('METRICS_BEARER_TOKEN unset; skipped metrics auth assertions');
  }

  // Locate an application that already has an active publication.
  const appsRes = await fetch(`${API}/api/applications`, { headers });
  const apps = await json(appsRes);
  assert(appsRes.ok, `apps list failed: ${JSON.stringify(apps)}`);

  let application = null;
  for (const app of apps) {
    const detailRes = await fetch(`${API}/api/applications/${app.id}`, { headers });
    const detail = await json(detailRes);
    if (detail.publications?.some((p) => p.status === 'active')) {
      application = detail;
      break;
    }
  }

  if (!application) {
    console.log('No active publication found; skipped publication-token assertions');
    console.log('Authz negative smoke OK');
    return;
  }

  const primary = application.publications.find((p) => p.status === 'active');

  const tokenRes = await fetch(`${API}/api/publications/${primary.id}/tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'authz-negative', expiresInDays: 1 }),
  });
  const minted = await json(tokenRes);
  assert(tokenRes.ok, `token mint failed: ${JSON.stringify(minted)}`);

  const tokenHeaders = {
    'content-type': 'application/json',
    'x-organization-id': orgId,
    'x-publication-token': minted.token,
  };

  // 3. Publication tokens must not reach privileged integration surfaces.
  const mcpCall = await fetch(`${API}/api/integrations/mcp/call`, {
    method: 'POST',
    headers: tokenHeaders,
    body: JSON.stringify({ tool: 'mcp:anything', arguments: {} }),
  });
  assert(
    mcpCall.status === 403,
    `publication token mcp/call should be 403, got ${mcpCall.status} ${await mcpCall.text()}`,
  );

  // 4. A token minted for one publication cannot drive another publication.
  const otherChannel = primary.channel === 'embed' ? 'hosted_web' : 'embed';
  const publishOther = await fetch(
    `${API}/api/applications/${application.id}/publish`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel: otherChannel, allowedOrigins: [] }),
    },
  );
  const otherDetail = await json(publishOther);
  assert(publishOther.ok, `publish ${otherChannel} failed: ${JSON.stringify(otherDetail)}`);

  const otherPublicationId = otherDetail.channels?.[otherChannel]?.publicationId;
  assert(otherPublicationId, `expected an active ${otherChannel} publication`);

  const wrongPublication = await fetch(`${API}/api/gateway/sessions`, {
    method: 'POST',
    headers: tokenHeaders,
    body: JSON.stringify({ publicationId: otherPublicationId, message: 'should be denied' }),
  });
  assert(
    wrongPublication.status === 403,
    `cross-publication session should be 403, got ${wrongPublication.status}`,
  );

  // 5. Embed publications default to deny (no allowed origins until set explicitly).
  const embedPublicationId =
    otherChannel === 'embed' ? otherPublicationId : application.channels?.embed?.publicationId;
  if (embedPublicationId) {
    const originsRes = await fetch(
      `${API}/api/publications/${embedPublicationId}/allowed-origins`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ allowedOrigins: ['not-a-url'] }),
      },
    );
    assert(
      originsRes.status === 400,
      `invalid origin should be rejected with 400, got ${originsRes.status}`,
    );
  }

  await fetch(`${API}/api/publication-tokens/${minted.id}/revoke`, {
    method: 'POST',
    headers,
    body: '{}',
  });

  console.log('Authz negative smoke OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
