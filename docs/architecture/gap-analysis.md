# Gap analysis

Living inventory. “Landed” means code exists in-repo; it does **not** imply production certification.

| Capability | Status | Notes |
| --- | --- | --- |
| Monorepo tooling | Landed | pnpm + Turborepo + CI |
| Auth | Landed | Better Auth email/password; hosted apps may use publication tokens |
| Tenancy/RBAC | Landed | Orgs, memberships, roles, invite/role APIs |
| Agent versions | Landed | Immutable versions + transitions |
| Approvals | Landed | Request/decision + SoD (no self-approve by default) |
| Runtime | Landed | Local + Claude adapters |
| Gateway | Landed | SSE with allowlisted CORS, rate limits, concurrency, org spend, timeouts |
| Publishing | Landed | Per-channel publish (`hosted_web` / `embed` / `api` / `desktop`) + tokens + `/api/v1` |
| Desktop | Landed (release path) | NSIS + updater UX + Windows release workflow; inject real pubkey/cert secrets for prod |
| Skills/MCP/Knowledge | Landed (live first pass) | Knowledge fetch + MCP tools/list + local `mcp:` tool calls; Claude uses catalog in prompt |
| Evals / budgets / tool allowlists | Landed | Gateway enforces tool + per-agent budgets |
| Secrets | Landed | AES-256-GCM store + `/api/secrets`; resolve stays server-side |
| Audit read | Landed | `GET /api/audit-events` |
| Observability | Landed (first pass) | Correlation ids, bearer-protected Prometheus `/metrics`, OpenTelemetry traces (OTLP HTTP when configured) |
| Embed security | Landed | Publication `allowedOrigins` drives CSP `frame-ancestors` + postMessage token delivery (default deny) |
| Retention / export | Landed (on-demand) | Per-org `retentionDays`, `POST /api/orgs/current/retention/purge`, `GET /api/orgs/current/export` |
| Backups | Landed | `pnpm backup:db` + `docs/operations/backups.md` restore steps |
| SSO / SCIM | Deferred | Email/password + invites only; OIDC/SAML and directory sync are post-pilot |

## Enterprise pilot hardening (landed)

- Gateway rate limiting moved to Redis (`INCR`/`PEXPIRE`), so limits hold across API replicas
- `/metrics` and `/api/metrics` require `METRICS_BEARER_TOKEN`; `loadEnv` refuses to boot production without one
- Fastify `trustProxy`; Better Auth request URLs come from `BETTER_AUTH_URL`, never the `Host` header
- Publication tokens are delivered to embeds over `postMessage` after an origin-checked handshake — never in a URL
- Embed framing is default deny; `frame-ancestors` is derived per publication in embed-runtime middleware
- SSRF guards on knowledge fetch and MCP client (`assertSafeOutboundUrl`, HTTPS required for MCP)
- Compose splits secrets away from the Next.js services, persists Redis, and documents Postgres backup/restore
- `pnpm smoke:authz` asserts cross-org, cross-publication, publication-token, and metrics denials

## Production follow-ups

- Production Compose package landed (`docker-compose.prod.yml` + `deploy/Dockerfile` backend image + `pnpm smoke:deploy`)
- TLS termination still operator-owned (reverse proxy / load balancer); Compose package does not ship certificates
- Run `pnpm desktop:gen-updater-keys`, keep private key in `.secrets/` / CI (`TAURI_SIGNING_PRIVATE_KEY`), set real CDN updater endpoints
- Provide `WINDOWS_CERT_*` secrets for Authenticode in `desktop-release` workflow
- Apple notarization when macOS target is added
- Claude-native MCP transport if/when Managed Agents exposes it
- Broader OTel auto-instrumentation (DB/Redis) beyond request spans
- Hosted/K8s charts beyond Compose (when operators need them)
- SSO / SAML / OIDC / SCIM / MFA (explicitly deferred from pilot hardening)