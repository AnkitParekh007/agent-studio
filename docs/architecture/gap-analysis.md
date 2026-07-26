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
| Publishing | Landed | Hosted runtime + unpublish/rollback + publication tokens |
| Desktop | Landed (shipping foundation) | NSIS bundle + updater plugin; replace placeholder pubkey and Authenticode cert before production |
| Skills/MCP/Knowledge | Landed (live first pass) | Knowledge fetch + MCP tools/list + local `mcp:` tool calls; Claude uses catalog in prompt |
| Evals / budgets / tool allowlists | Landed | Gateway enforces tool + per-agent budgets |
| Secrets | Landed | AES-256-GCM store + `/api/secrets`; resolve stays server-side |
| Audit read | Landed | `GET /api/audit-events` |
| Observability | Landed (first pass) | Correlation ids, Prometheus `/metrics`, OpenTelemetry traces (OTLP HTTP when configured) |

## Production follow-ups (not blockers for “partials”)

- Replace desktop updater placeholder pubkey; wire real release CDN endpoints
- Authenticode / Apple notarization certificates in CI
- Claude-native MCP transport if/when Managed Agents exposes it
- Broader OTel auto-instrumentation (DB/Redis) beyond request spans
