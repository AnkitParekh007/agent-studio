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

  const stamp = Date.now();
  const skill = await json(
    await fetch(`${API}/api/skills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key: `sum-${stamp}`,
        name: 'Summarize',
        promptFragment: 'Prefer bullet summaries.',
      }),
    }),
  );
  const mcp = await json(
    await fetch(`${API}/api/mcp-servers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key: `mcp-${stamp}`,
        name: 'Example MCP',
        endpointUrl: 'https://example.com/mcp',
      }),
    }),
  );
  const knowledge = await json(
    await fetch(`${API}/api/knowledge-sources`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key: `know-${stamp}`,
        name: 'Handbook',
        uri: 'https://example.com/handbook',
      }),
    }),
  );

  const agent = await json(
    await fetch(`${API}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Phase7 Agent',
        slug: `p7-${stamp}`,
        description: 'governance smoke',
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
        toolPermissions: ['local.echo'],
        runtimeLimits: { timeoutSeconds: 300, maxToolCalls: 10 },
        budgets: { maxTokens: 50000 },
        skillIds: [skill.id],
        mcpServerIds: [mcp.id],
        knowledgeSourceIds: [knowledge.id],
      },
    }),
  });

  const startedOk = await json(
    await fetch(`${API}/api/playground/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: agent.id,
        versionId: agent.currentDraftVersionId,
        message: 'Hello governance',
      }),
    }),
  );
  const okStream = await (
    await fetch(`${API}/api/playground/sessions/${startedOk.sessionId}/stream`, {
      method: 'POST',
      headers: { cookie: cookieHeader(cookies), 'x-organization-id': orgId },
    })
  ).text();
  if (!okStream.includes('message.completed') && !okStream.includes('message.delta')) {
    throw new Error(`expected successful stream, got: ${okStream.slice(0, 400)}`);
  }

  const deniedAgent = await json(
    await fetch(`${API}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Phase7 Denied Tools',
        slug: `p7-deny-${stamp}`,
      }),
    }),
  );
  await fetch(`${API}/api/agents/${deniedAgent.id}/draft`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      config: {
        runtimeProvider: 'local',
        instructions: { purpose: 'Answer briefly.' },
        toolPermissions: ['not.allowed'],
        budgets: { maxTokens: 50000 },
      },
    }),
  });
  const deniedStart = await json(
    await fetch(`${API}/api/playground/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: deniedAgent.id,
        versionId: deniedAgent.currentDraftVersionId,
        message: 'Should deny tool',
      }),
    }),
  );
  const deniedStream = await (
    await fetch(`${API}/api/playground/sessions/${deniedStart.sessionId}/stream`, {
      method: 'POST',
      headers: { cookie: cookieHeader(cookies), 'x-organization-id': orgId },
    })
  ).text();
  if (!deniedStream.includes('tool.denied') && !deniedStream.includes('not in the version allowlist')) {
    throw new Error(`expected tool denial, got: ${deniedStream.slice(0, 500)}`);
  }

  const suite = await json(
    await fetch(`${API}/api/eval-suites`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: agent.id,
        name: `suite-${stamp}`,
        cases: [
          {
            name: 'echo',
            prompt: 'Ping',
            expectContains: 'local-dev',
          },
        ],
      }),
    }),
  );
  const run = await json(
    await fetch(`${API}/api/eval-suites/${suite.id}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ versionId: agent.currentDraftVersionId }),
    }),
  );
  if (run.status !== 'completed' || Number(run.passedCount) < 1) {
    throw new Error(`eval run unexpected: ${JSON.stringify(run)}`);
  }

  console.log('PHASE7 GOVERNANCE SMOKE OK', {
    skillId: skill.id,
    mcpId: mcp.id,
    knowledgeId: knowledge.id,
    evalRunId: run.id,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
