# Environment variables

High-signal variables. Full templates: `.env.example` and `.env.production.example`.

## Always

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` / Compose Postgres vars | Persistence |
| `REDIS_URL` | Queues, rate limits, lockout |
| `BETTER_AUTH_SECRET` | Auth signing (≥32 chars) |
| `SECRETS_MASTER_KEY` | Secret box key (≥32 chars) |
| `API_BASE_URL` / `BETTER_AUTH_URL` / `NEXT_PUBLIC_API_BASE_URL` | Public API origin |
| `CORS_ORIGINS` / `*_ORIGIN` | Browser allowlist |

## Production

| Variable | Purpose |
| --- | --- |
| `METRICS_BEARER_TOKEN` | Required; guards `/metrics` |
| `ANTHROPIC_API_KEY` | Claude runtime |
| `DEFAULT_RUNTIME_PROVIDER=claude` | Prod default |
| `TRUST_PROXY_HOPS` | Usually `1` behind Caddy |
| `DATA_RETENTION_DAYS` | Default 90 |

## Identity (opt-in)

`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `REQUIRE_MFA_FOR_PRIVILEGED`

## Gateway

`GATEWAY_RATE_LIMIT_PER_MINUTE`, `GATEWAY_MAX_CONCURRENT_SESSIONS`, `GATEWAY_SESSION_TIMEOUT_MS`, `ALLOW_SELF_APPROVAL`
