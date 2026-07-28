# Deployment

## Environments

| Env | Notes |
| --- | --- |
| Local | `docker compose up -d` (Postgres/Redis only) + `pnpm dev` |
| Test | Ephemeral DB/Redis in CI |
| Production package | `docker-compose.prod.yml` — full stack in containers |

## Production Compose package

Supported way to run the full stack outside day-to-day local development.
For a first pilot bring-up (OIDC/MFA, ACME swap, backups, smokes), follow
[pilot-dry-run.md](./pilot-dry-run.md).

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
| `caddy` | TLS termination in front of everything above | `443` |
| `seed` | **demo profile only** — never for real production | — |

The backend image runs as the unprivileged `node` user; `docker compose exec api id -u` must not
return `0`.

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
   | `METRICS_BEARER_TOKEN` | Required in production; guards `/metrics` and `/api/metrics` |
   | `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` / `BETTER_AUTH_URL` | Public browser-reachable API origin |
   | `CONTROL_PLANE_ORIGIN` / `AGENT_RUNTIME_ORIGIN` / `EMBED_RUNTIME_ORIGIN` | Public web origins |
   | `CORS_ORIGINS` | Comma-separated allowlist matching those origins |
   | `TRUST_PROXY_HOPS` | `1` behind the bundled Caddy; must match your real proxy depth |
   | `CADDY_*_HOST` | Hostnames Caddy serves on `443` (see [deploy/caddy/README.md](../../deploy/caddy/README.md)) |
   | `OIDC_*` | Optional enterprise SSO; all three of issuer/client id/client secret or none |
   | `REQUIRE_MFA_FOR_PRIVILEGED` | Enable only after privileged users have enrolled TOTP |

3. Production hard rules (enforced by `@agent-studio/config`):

   - `NODE_ENV=production`
   - `RUNTIME_ALLOW_LOCAL` must be false / unset
   - `METRICS_BEARER_TOKEN` must be set
   - Never auto-seed (`seed` profile is opt-in and forces `NODE_ENV=development` for that one-shot only)

   Verify the contract without booting the stack: `pnpm check:prod-env`.

   Only `api`, `worker`, and `migrate` receive secrets. The three Next.js services get public URLs
   only, so a template-injection bug in an end-user app cannot read `SECRETS_MASTER_KEY`.

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
- `GET /metrics` — Prometheus (also `/api/metrics`); send `Authorization: Bearer $METRICS_BEARER_TOKEN`

## Backups

See [backups.md](./backups.md). `pnpm backup:db` dumps Postgres; Redis persists on the
`agentstudio_prod_redis` volume but is not part of the recovery contract.

## Migrations

`migrate` runs to completion before `api` / `worker` start. For non-Compose deploys, run `pnpm db:migrate` (or `node packages/database/dist/migrate.js` with `DATABASE_URL`) before rolling new API/worker versions. Never auto-seed in production.

## Scheduled jobs

| Job | Where | Schedule |
| --- | --- | --- |
| Retention purge across all orgs | `worker` (`apps/worker/src/retention-purge.ts`) | On boot, then every 24h |
| Postgres backup | Operator cron | Not scheduled by the stack |

The worker applies each org's `retentionDays` (falling back to `DATA_RETENTION_DAYS`) and writes an
`org.retention_purged` audit event whenever it deletes anything. The on-demand
`POST /api/orgs/current/retention/purge` endpoint still exists for immediate purges.

Backups stay operator-owned. Add a host cron entry that runs the existing script:

```cron
# Nightly Postgres dump into ./backups
15 2 * * *  cd /srv/agent-studio && pnpm backup:db >> /var/log/agent-studio-backup.log 2>&1
```

See [backups.md](./backups.md) for retention and restore steps.

## Data export and erasure

| Operation | Endpoint | Contents |
| --- | --- | --- |
| Export | `GET /api/orgs/current/export` | Org metadata, members, agents, session summaries, usage totals and monthly aggregates, audit action/resource/timestamp summaries. Capped at 1000 rows per collection. Never includes prompts, completions, event payloads or secret values. |
| Erasure | `DELETE /api/orgs/current` | Body `{"confirmSlug":"<org slug>"}`. Irreversible. |

Erasure deletes the `organizations` row; every org-scoped table declares
`organization_id ... on delete cascade`, so agents, versions, publications, tokens, invites,
settings, secrets and runtime telemetry go with it. `audit_events.organization_id` is
`on delete set null` by design, so the immutable trail survives the tenant — the `org.erased`
event records the erased id and slug in its metadata. Export before erasing.

## TLS

`docker-compose.prod.yml` ships a Caddy service that terminates TLS on `443` and reverse-proxies to
the API and the three Next.js apps over plain HTTP inside the Compose network. It defaults to
`tls internal` (Caddy's own local CA, certificates stored in the `agentstudio_prod_caddy` volume),
so **no certificate or private key is committed to this repository**.

For a real deployment, either mount a certificate pair into `deploy/caddy/certs/` (git-ignored) or
switch the `(site)` snippet to ACME. Full instructions, including how to export the local CA for
client trust, are in [deploy/caddy/README.md](../../deploy/caddy/README.md).

If you terminate TLS at your own load balancer instead, leave the `caddy` service stopped and set
`TRUST_PROXY_HOPS` to your proxy depth. Either way, point `API_BASE_URL`, `BETTER_AUTH_URL`,
`NEXT_PUBLIC_API_BASE_URL` and the three web origins at the public HTTPS URLs, and keep
`CORS_ORIGINS` in sync.
