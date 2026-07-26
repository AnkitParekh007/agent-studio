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
| Observability | Landed (first pass) | Correlation ids, Prometheus `/metrics`, OpenTelemetry traces (OTLP HTTP when configured) |

## Production follow-ups

- Run `pnpm desktop:gen-updater-keys` and paste pubkey + set `TAURI_SIGNING_PRIVATE_KEY` / CDN endpoints
- Provide `WINDOWS_CERT_*` secrets for Authenticode in `desktop-release` workflow
- Apple notarization when macOS target is added
- Claude-native MCP transport if/when Managed Agents exposes it
- Broader OTel auto-instrumentation (DB/Redis) beyond request spans
