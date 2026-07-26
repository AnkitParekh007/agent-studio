# Deployment

## Environments

| Env | Notes |
| --- | --- |
| Local | docker-compose Postgres/Redis |
| Test | Ephemeral DB for CI integration (optional) |
| Preview | Branch deploys with `RUNTIME_ALLOW_LOCAL=false` unless intentionally demoing |
| Production | `RUNTIME_ALLOW_LOCAL` must be false; Claude credentials via secret manager |

## Required services

- PostgreSQL 16+
- Redis 7+
- API + worker processes
- Control plane and agent-web-runtime frontends

## Health

- `GET /health` — liveness
- `GET /ready` — DB connectivity

## Migrations

Run `pnpm db:migrate` before starting new API versions. Never auto-seed in production.
