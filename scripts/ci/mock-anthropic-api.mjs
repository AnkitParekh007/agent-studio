/**
 * CI-ONLY HTTP double for the Anthropic Managed Agents endpoints the Claude runtime
 * adapter calls. It exists so the production Compose stack can be smoke-tested with
 * NODE_ENV=production and DEFAULT_RUNTIME_PROVIDER=claude without real credentials.
 *
 * It is never referenced by application code, never bundled into the backend image,
 * and is wired in only through docker-compose.ci-prod.yml.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8787);

/** providerSessionId -> user messages submitted so far. */
const sessions = new Map();

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const body = req.method === 'GET' ? {} : await readJson(req);

  if (path === '/healthz') return send(res, 200, { ok: true });

  if (req.method === 'POST' && path === '/v1/environments') {
    return send(res, 200, { id: `env_${randomUUID()}`, type: 'environment' });
  }

  if (req.method === 'POST' && path === '/v1/agents') {
    return send(res, 200, { id: `agent_${randomUUID()}`, type: 'agent' });
  }

  if (req.method === 'POST' && path === '/v1/sessions') {
    const id = `session_${randomUUID()}`;
    sessions.set(id, []);
    return send(res, 200, { id, type: 'session' });
  }

  const eventsMatch = path.match(/^\/v1\/sessions\/([^/]+)\/events$/);
  if (eventsMatch) {
    const sessionId = eventsMatch[1];
    if (!sessions.has(sessionId)) sessions.set(sessionId, []);

    if (req.method === 'POST') {
      const text = body?.events?.[0]?.content?.[0]?.text ?? '';
      sessions.get(sessionId).push(String(text));
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET') {
      const prompts = sessions.get(sessionId);
      const reply = `Mock Claude reply to: ${prompts[prompts.length - 1] ?? '(no input)'}`;
      return send(res, 200, {
        data: [
          { type: 'message_delta', delta: { text: reply } },
          { type: 'message_stop', usage: { input_tokens: 12, output_tokens: 8 } },
          { type: 'session.ended' },
        ],
      });
    }
  }

  if (req.method === 'POST' && /^\/v1\/sessions\/[^/]+\/archive$/.test(path)) {
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: { type: 'not_found', message: `${req.method} ${path}` } });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CI Anthropic double listening on :${PORT}`);
});
