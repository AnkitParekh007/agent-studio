/**
 * Smoke the production Compose stack (health + public surfaces).
 * Expects: docker compose -f docker-compose.prod.yml ... up
 *
 *   pnpm smoke:deploy
 */

const API = process.env.API_BASE_URL ?? 'http://localhost:4000';
const CONTROL = process.env.CONTROL_PLANE_ORIGIN ?? 'http://localhost:3000';
const AGENT_WEB = process.env.AGENT_RUNTIME_ORIGIN ?? 'http://localhost:3001';
const EMBED = process.env.EMBED_RUNTIME_ORIGIN ?? 'http://localhost:3002';

async function check(name, url, { ok = (res) => res.ok } = {}) {
  const res = await fetch(url, { redirect: 'manual' });
  if (!ok(res)) {
    const body = await res.text().catch(() => '');
    throw new Error(`${name} failed: ${res.status} ${url} ${body.slice(0, 200)}`);
  }
  console.log(`ok  ${name} (${res.status}) ${url}`);
}

async function main() {
  console.log('Deploy smoke against', { API, CONTROL, AGENT_WEB, EMBED });

  await check('api /health', `${API}/health`);
  await check('api /ready', `${API}/ready`);
  await check('api /api/v1', `${API}/api/v1`);

  // Next apps may 200 or redirect; treat any <500 as up.
  const webOk = (res) => res.status > 0 && res.status < 500;
  await check('control-plane-web', CONTROL, { ok: webOk });
  await check('agent-web-runtime', AGENT_WEB, { ok: webOk });
  await check('embed-runtime', EMBED, { ok: webOk });

  console.log('Deploy smoke passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
