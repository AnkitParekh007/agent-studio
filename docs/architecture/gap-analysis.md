# Gap analysis

Living inventory. “Landed” means code exists in-repo; it does **not** imply production certification.

| Capability | Status | Notes |
| --- | --- | --- |
| Monorepo tooling | Landed | pnpm + Turborepo + CI |
| Auth | Landed | Better Auth email/password + optional OIDC; TOTP MFA available; hosted apps may use publication tokens |
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
| Retention / export | Landed (scheduled + on-demand) | Per-org `retentionDays`, daily worker purge across all orgs, `POST /api/orgs/current/retention/purge`, expanded `GET /api/orgs/current/export` |
| Erasure | Landed | `DELETE /api/orgs/current` cascades every org-scoped table; audit trail survives by design |
| Backups | Landed | `pnpm backup:db` + `docs/operations/backups.md` restore steps; cron is operator-owned |
| TLS | Landed (Compose package) | Caddy service terminates TLS on `443`; `tls internal` by default, no keys in repo |
| SSO / MFA | Landed (opt-in) | OIDC via Better Auth `genericOAuth`; TOTP + backup codes via `twoFactor`; `REQUIRE_MFA_FOR_PRIVILEGED` soft gate |
| SCIM / SAML | Deferred | Directory sync and SAML remain post-pilot; membership still flows through invites |

## Enterprise pilot hardening (landed)

- Gateway rate limiting moved to Redis (`INCR`/`PEXPIRE`), so limits hold across API replicas
- `/metrics` and `/api/metrics` require `METRICS_BEARER_TOKEN`; `loadEnv` refuses to boot production without one
- Fastify `trustProxy`; Better Auth request URLs come from `BETTER_AUTH_URL`, never the `Host` header
- Publication tokens are delivered to embeds over `postMessage` after an origin-checked handshake — never in a URL
- Embed framing is default deny; `frame-ancestors` is derived per publication in embed-runtime middleware
- SSRF guards on knowledge fetch and MCP client (`assertSafeOutboundUrl`, HTTPS required for MCP)
- Compose splits secrets away from the Next.js services, persists Redis, and documents Postgres backup/restore
- `pnpm smoke:authz` asserts cross-org, cross-publication, publication-token, and metrics denials

## Enterprise pilot top-5 (landed)

- **Identity**: Redis-backed per-IP rate limiting and IP+email lockout on `/api/auth/*`; Better Auth
  `twoFactor` (TOTP + backup codes) always registered; `genericOAuth` enabled when `OIDC_*` is set;
  `REQUIRE_MFA_FOR_PRIVILEGED` soft gate for `org_owner` / `org_admin` / `agent_approver` /
  `platform_admin`. Client IP resolution is bounded by `TRUST_PROXY_HOPS`. See
  [security/identity.md](../security/identity.md)
- **Production CI**: `production-stack` job boots the real `docker-compose.prod.yml`
  (`NODE_ENV=production`, local adapter forbidden), asserts the API runs non-root, then runs
  `smoke:deploy` + `smoke:authz` against it. The Claude adapter points at a CI-only HTTP double
  (`scripts/ci/mock-anthropic-api.mjs`, wired in by `docker-compose.ci-prod.yml`) so the production
  path is exercised without provider credentials — the double is never reachable from app code
- **Hardening**: Caddy TLS front door on `443` (`tls internal`, no keys committed); backend image
  runs as `USER node`; worker purges expired telemetry across all orgs on boot and every 24h
- **Spend / concurrency**: concurrency is an atomic Redis counter released exactly-once on
  end / cancel / timeout (guarded by a `status = 'active'` predicate) instead of a racy DB
  `count(*)`; org monthly spend is re-checked on every `usage` event and force-ends the session
- **Export / erasure**: exports now include session summaries, usage totals and monthly aggregates,
  and audit action/resource/timestamp summaries; `DELETE /api/orgs/current` performs cascading
  tenant erasure behind a slug confirmation

## Production follow-ups

- Production Compose package landed (`docker-compose.prod.yml` + `deploy/Dockerfile` backend image + `pnpm smoke:deploy`)
- Caddy ships with `tls internal`; swap to operator certificates or ACME before exposing publicly
- Run `pnpm desktop:gen-updater-keys`, keep private key in `.secrets/` / CI (`TAURI_SIGNING_PRIVATE_KEY`), set real CDN updater endpoints
- Provide `WINDOWS_CERT_*` secrets for Authenticode in `desktop-release` workflow
- Apple notarization when macOS target is added
- Claude-native MCP transport if/when Managed Agents exposes it
- Broader OTel auto-instrumentation (DB/Redis) beyond request spans
- Hosted/K8s charts beyond Compose (when operators need them)
- SAML and SCIM directory sync (OIDC and MFA landed; these remain deferred)