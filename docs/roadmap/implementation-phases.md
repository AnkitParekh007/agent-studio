# Implementation phases

Status labels mean “vertical slice landed,” not enterprise-complete. See [gap analysis](../architecture/gap-analysis.md) for remaining hardening.

| Phase | Focus | Status |
| --- | --- | --- |
| 0 | Architecture, ADRs, plan, baseline | First pass (docs need ongoing truth-keeping) |
| 1 | Auth, tenancy, RBAC, audit, UI foundation | MVP slice + tenant admin APIs (invite/roles) |
| 2 | Agent CRUD, versions, approval | MVP slice + separation-of-duties guard |
| 3 | Runtime adapters + Agent Gateway | Local + Claude; CORS/rate limits/org spend/timeouts |
| 4 | Full playground UX | Control-plane playground + streaming timeline |
| 5 | Application Studio templates + polish | Templates, studio UI, branded runtime |
| 6 | Tauri desktop shell | Shell + keychain + gateway chat + NSIS bundle + updater plugin (prod certs/pubkey still required) |
| 7 | Skills, MCP, knowledge, evals, budgets | Live knowledge fetch + MCP tools/list + local `mcp:` calls; gateway budgets/tools |

## Enterprise hardening (post Phase 7)

| Workstream | Status |
| --- | --- |
| WS0 Truth in docs | Landed |
| WS1 Secrets encrypt + API | Landed (create/rotate/list; resolve server-side only) |
| WS2 Gateway CORS, rate limits, publication tokens | Landed |
| WS3 Tenant admin, SoD, lifecycle rollback | Landed |
| WS4 CI with Postgres/Redis + smokes | Landed |
| WS5 Audit read, timeouts, MCP honesty | Landed |
| WS6 Hosted publication-token auth | Landed |
| WS7 Correlation logs + `/metrics` | Landed |

First vertical slice (create → approve → provision → publish → stream) remains the gating milestone before expanding surface area.
