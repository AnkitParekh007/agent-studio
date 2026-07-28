# Pilot dry-run

End-to-end checklist for bringing up the production Compose package on a clean host,
wiring identity, TLS, backups, and walking create → approve → publish → embed/API.

Do **not** expose a public URL while Caddy is still on `tls internal`.

## 0. Prerequisites

- Docker Desktop / Engine running
- `.env.production` filled (never commit it)
- Anthropic API key for Claude runtime
- (SSO) OIDC issuer URL, client id, client secret from your IdP
- (Public TLS) DNS for the four `CADDY_*_HOST` names + an ACME contact email

## 1. Production env

```bash
cp .env.production.example .env.production   # if starting from scratch
# set POSTGRES_PASSWORD, BETTER_AUTH_SECRET, SECRETS_MASTER_KEY,
# METRICS_BEARER_TOKEN, ANTHROPIC_API_KEY
pnpm check:prod-env
```

Identity knobs:

| Variable | Pilot value |
| --- | --- |
| `OIDC_ISSUER_URL` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Real IdP values, or leave all three empty |
| `REQUIRE_MFA_FOR_PRIVILEGED` | Start `false` → enroll TOTP for owner/admin/approver → flip to `true` and recreate `api` |
| `TRUST_PROXY_HOPS` | `1` behind bundled Caddy |

Redirect URI to register at the IdP:

`{BETTER_AUTH_URL}/api/auth/oauth2/callback/{OIDC_PROVIDER_ID}`

(default provider id `oidc`).

## 2. Clean migrate + bring-up (local / private)

Uses `tls internal` — fine for a closed pilot network, **not** for a public hostname.

```bash
pnpm deploy:down          # optional: wipe previous pilot stack
# for a truly clean DB volume:
# docker compose -f docker-compose.prod.yml --env-file .env.production down -v

pnpm deploy:up            # build + migrate service + api/worker/web/caddy
# Demo identities (owner@example.com / Password123! + approver):
docker compose -f docker-compose.prod.yml --env-file .env.production --profile demo run --rm seed
```

Migrations run via the `migrate` service on every `deploy:up` (clean volume ⇒ full apply).
Host-side equivalent against a reachable `DATABASE_URL`: `pnpm db:migrate`.

## 3. Swap Caddy to real certs **before** any public URL

### Option A — public ACME (Let's Encrypt)

1. Point DNS for `CADDY_API_HOST`, `CADDY_CONTROL_PLANE_HOST`, `CADDY_AGENT_RUNTIME_HOST`,
   `CADDY_EMBED_HOST` at this host.
2. Set `ACME_EMAIL` and change browser-facing URLs to `https://…` in `.env.production`
   (`API_BASE_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_API_BASE_URL`, `*_ORIGIN`, `CORS_ORIGINS`).
3. Rebuild so Next picks up `NEXT_PUBLIC_*`, then:

```bash
pnpm deploy:up:acme
```

### Option B — mounted certificate pair

Place `site.crt` + `site.key` in `deploy/caddy/certs/` (git-ignored), point Caddy at
`deploy/caddy/Caddyfile.file-certs` (same volume mount pattern as the ACME override).

See [deploy/caddy/README.md](../../deploy/caddy/README.md).

## 4. MFA enrollment (then enforce)

1. Sign in as each privileged role (`org_owner`, `org_admin`, `agent_approver`).
2. Enroll TOTP via Better Auth two-factor UI / API.
3. Set `REQUIRE_MFA_FOR_PRIVILEGED=true` in `.env.production`.
4. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d api --force-recreate`

Privileged API calls without a verified second factor then return 403.

## 5. Backups + restore drill

```bash
pnpm backup:db
pnpm backup:schedule --install   # prints Task Scheduler / cron lines
pnpm backup:restore-drill        # safe restore into *_restore_drill
# only when you intentionally want a destructive live restore:
# pnpm backup:restore-drill -- --live
```

Confirm off-host copy of `./backups/*.sql.gz` and that `SECRETS_MASTER_KEY` lives somewhere
else. Details: [backups.md](./backups.md).

## 6. Retention purge

Worker runs a retention sweep on boot and every 24h (`DATA_RETENTION_DAYS`, default 90).

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs worker | findstr /I retention
# Linux/macOS: … logs worker | grep -i retention
```

Expect a boot line mentioning retention purge every 24h. When rows are deleted, an
`org.retention_purged` audit event is written. On-demand: `POST /api/orgs/current/retention/purge`.

## 7. Smokes + publish walk

Against the stack (default `http://localhost:4000`):

```bash
pnpm smoke:deploy
# Remapped host ports + production Claude runtime:
CONTROL_PLANE_ORIGIN=http://localhost:13000 \
METRICS_BEARER_TOKEN="$(grep METRICS_BEARER_TOKEN .env.production | cut -d= -f2-)" \
SMOKE_RUNTIME_PROVIDER=claude \
  pnpm smoke:authz

CONTROL_PLANE_ORIGIN=http://localhost:13000 SMOKE_RUNTIME_PROVIDER=claude \
  pnpm smoke:publish-channels   # embed + API publication path
```

On Windows PowerShell, set the same variables with `$env:CONTROL_PLANE_ORIGIN=...` before invoking `pnpm`.

`smoke:publish-channels` and the authz fixture path require a **valid** `ANTHROPIC_API_KEY` (provisioning returns 401 otherwise).

Manual walk:

1. **Create** — control plane: new agent + draft version.
2. **Approve** — submit for review; approve as a *different* user (`approver@example.com` when seeded).
3. **Publish** — web / embed / API channel; copy publication token.
4. **Embed** — load embed runtime with allowlisted origin; confirm postMessage token delivery (token must not appear in the iframe URL).
5. **API** — `Authorization: Bearer pub_…` or `x-publication-token` against the gateway session endpoints only (no MCP via pub token).

## 8. Sign-off checklist

- [ ] Clean volume + migrate completed successfully
- [ ] `.env.production` has real secrets + `METRICS_BEARER_TOKEN` + Anthropic
- [ ] OIDC pointed at real IdP **or** explicitly deferred (all three OIDC vars empty)
- [ ] MFA enrolled for privileged users, then `REQUIRE_MFA_FOR_PRIVILEGED=true`
- [ ] Caddy on ACME or file certs before any public DNS cutover
- [ ] Daily backup scheduled; restore drill passed
- [ ] Worker logs show retention schedule / purge
- [ ] `smoke:deploy` + `smoke:authz` green; create → approve → publish → embed/API walked
