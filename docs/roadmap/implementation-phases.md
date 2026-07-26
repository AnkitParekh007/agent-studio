# Implementation phases

| Phase | Focus | Status |
| --- | --- | --- |
| 0 | Audit, ADRs, plan, baseline | Completed (first pass) |
| 1 | Auth, tenancy, RBAC, audit, UI foundation | Completed (MVP slice) |
| 2 | Agent CRUD, versions, approval | Completed (MVP slice) |
| 3 | Runtime adapters + Agent Gateway | Completed (local + Claude adapter; smoke verified local) |
| 4 | Full playground UX | Completed (control-plane playground + streaming timeline) |
| 5 | Application Studio templates + polish | Completed (templates, studio UI, branded runtime) |
| 6 | Tauri desktop shell | Completed (Tauri shell + keychain session + gateway chat) |
| 7 | Skills, MCP, knowledge, evals, budgets | Completed (catalogs + gateway enforcement + evals) |

First vertical slice (create → approve → provision → publish → stream) is the gating milestone before expanding surface area.
