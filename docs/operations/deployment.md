# Deployment

## Environments

| Env | Notes |
| --- | --- |
| Local | `docker compose up -d` (Postgres/Redis only) + `pnpm dev` |
| Test | Ephemeral DB/Redis in CI |
| Production package | `docker-compose.prod.yml` — full stack in containers |

## Production Compose package

Supported way to run the full stack outside day-to-day local development.

### Services

One application image (`deploy/Dockerfile` target `backend`) is reused with different commands:

| Service | Role | Host port (default) |
| --- | --- | --- |
| `postgres` | PostgreSQL 16 | internal only |
| `redis` | Redis 7 | internal only |
| `migrate` | one-shot Drizzle migrations | — |
| `api` | NestJS control plane + Agent Gateway | `4000` |
| `worker` | BullMQ provision jobs | — |
| `control-plane-web` | Builder UI | `3000` |
| `agent-web-runtime` | Hosted published apps | `3001` |
| `embed-runtime` | Embed iframe runtime | `3002` |
| `seed` | **demo profile only** — never for real production | — |

### Checklist

1. Copy env template and set secrets:

   ```bash
   cp .env.production.example .env.production
   ```

2. Required values in `.env.production`:

   | Variable | Rule |
   | --- | --- |
   | `POSTGRES_PASSWORD` | Strong password |
   | `BETTER_AUTH_SECRET` | ≥ 32 characters |
   | `SECRETS_MASTER_KEY` | ≥ 32 characters |
   | `ANTHROPIC_API_KEY` | Required for Claude runtime (`DEFAULT_RUNTIME_PROVIDER=claude`) |
   | `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` / `BETTER_AUTH_URL` | Public browser-reachable API origin |
   | `CONTROL_PLANE_ORIGIN` / `AGENT_RUNTIME_ORIGIN` / `EMBED_RUNTIME_ORIGIN` | Public web origins |
   | `CORS_ORIGINS` | Comma-separated allowlist matching those origins |

3. Production hard rules (enforced by `@agent-studio/config`):

   - `NODE_ENV=production`
   - `RUNTIME_ALLOW_LOCAL` must be false / unset
   - Never auto-seed (`seed` profile is opt-in and forces `NODE_ENV=development` for that one-shot only)

4. Build and start:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   # or: pnpm deploy:up
   ```

   If host ports `3000`–`3002` are already in use, set `CONTROL_PLANE_HOST_PORT` / `AGENT_RUNTIME_HOST_PORT` / `EMBED_RUNTIME_HOST_PORT` (and matching `*_ORIGIN` + `CORS_ORIGINS`) in `.env.production`.

5. Verify:

   ```bash
   pnpm smoke:deploy
   ```

   When using remapped host ports, export the same origins for the smoke:

   ```bash
   CONTROL_PLANE_ORIGIN=http://localhost:13000 \
   AGENT_RUNTIME_ORIGIN=http://localhost:13001 \
   EMBED_RUNTIME_ORIGIN=http://localhost:13002 \
   pnpm smoke:deploy
   ```

6. Optional **local demo users only** (owner/approver seed — not for real production):

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production --profile demo run --rm seed
   ```

7. Stop:

   ```bash
   pnpm deploy:down
   ```

When changing the public API URL, rebuild so `NEXT_PUBLIC_API_BASE_URL` is baked into the Next apps at image build time.

## Health

- `GET /health` — liveness
- `GET /ready` — DB connectivity
- `GET /metrics` — Prometheus (also `/api/metrics`)

## Migrations

`migrate` runs to completion before `api` / `worker` start. For non-Compose deploys, run `pnpm db:migrate` (or `node packages/database/dist/migrate.js` with `DATABASE_URL`) before rolling new API/worker versions. Never auto-seed in production.

## TLS and reverse proxies

Terminate TLS at your load balancer / reverse proxy. Point `API_BASE_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_API_BASE_URL`, and the three web origins at the public HTTPS URLs, and keep `CORS_ORIGINS` in sync.
