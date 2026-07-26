import { API, json, signIn, orgHeaders } from './smoke-lib.mjs';

async function main() {
  const cookies = await signIn('owner@example.com');
  const headers = await orgHeaders(cookies);

  const secretRes = await fetch(`${API}/api/secrets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `mcp-secret-${Date.now()}`,
      purpose: 'mcp',
      value: 'not-used-for-inline-knowledge',
    }),
  });
  if (!secretRes.ok) throw new Error(`secret create failed: ${await secretRes.text()}`);

  const knowledgeRes = await fetch(`${API}/api/knowledge-sources`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key: `kb-${Date.now()}`,
      name: 'Inline Policy',
      sourceType: 'text',
      uri: 'text:Enterprise refund window is 30 days.',
      description: 'smoke knowledge',
    }),
  });
  const knowledge = await json(knowledgeRes);
  if (!knowledgeRes.ok) throw new Error(`knowledge create failed: ${JSON.stringify(knowledge)}`);

  const retrieveRes = await fetch(`${API}/api/integrations/knowledge/retrieve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ knowledgeSourceIds: [knowledge.id] }),
  });
  const retrieved = await json(retrieveRes);
  if (!retrieveRes.ok) throw new Error(`knowledge retrieve failed: ${JSON.stringify(retrieved)}`);
  if (!String(retrieved[0]?.content || '').includes('30 days')) {
    throw new Error('expected retrieved knowledge content');
  }

  const metrics = await fetch(`${API}/metrics`);
  const text = await metrics.text();
  if (!metrics.ok || !text.includes('agent_studio_uptime_seconds')) {
    throw new Error('metrics missing');
  }

  console.log('Integrations smoke OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
