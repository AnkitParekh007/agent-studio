# Run a production pilot

Bring up the Compose package like an enterprise pilot — not a laptop demo.

## Checklist (short)

1. Copy `.env.production.example` → `.env.production` (secrets, Anthropic, metrics bearer).
2. `pnpm deploy:up` on a clean volume (migrate runs in-compose).
3. Keep Caddy on `tls internal` until public DNS exists; then `pnpm deploy:up:acme` or file certs.
4. Schedule `pnpm backup:db`; run `pnpm backup:restore-drill`.
5. Confirm worker retention purge logs (90d default).
6. `pnpm smoke:deploy` + `pnpm smoke:authz` + publish walk.

Full narrative: [Pilot dry-run](../operations/pilot-dry-run.md) and the repo file `docs/operations/pilot-dry-run.md`.

## Production hard rules

| Rule | Why |
| --- | --- |
| `NODE_ENV=production` | Enables prod contracts |
| No `RUNTIME_ALLOW_LOCAL` | Local adapter blocked |
| `METRICS_BEARER_TOKEN` set | `/metrics` stays private |
| Secrets not on Next services | Template bugs cannot read master keys |
| MFA after enrollment | Avoid lockout |

> [!TIP]
> On remapped host ports (e.g. control plane `13000`), set `CONTROL_PLANE_ORIGIN` for smokes so Better Auth accepts the Origin header.
