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
| Desktop | Partial | Tauri 2 shell; code signing / auto-update deferred |
| Skills/MCP/Knowledge | Partial | Org **catalogs** + version attachments; MCP/knowledge are **not** live connected runtimes |
| Evals / budgets / tool allowlists | Landed (first pass) | Gateway enforces tool + per-agent budgets |
| Secrets | Landed | AES-256-GCM store + `/api/secrets`; resolve stays server-side |
| Audit read | Landed | `GET /api/audit-events` |
| Observability | Partial | Correlation id header, JSON logs, Prometheus text `/metrics` — no full OTel yet |

## Honest limits

- MCP server rows store endpoint metadata and optional `secretReferenceId`; the gateway does **not** open MCP transports yet.
- Knowledge sources are catalog entries used for governance/prompt context, not a retrieval pipeline.
- Desktop shipping (signing, updaters, store packaging) is documented as deferred in `docs/operations/desktop-releases.md`.
