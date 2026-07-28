# Architecture

Agent Studio is a Turborepo monorepo: NestJS API + worker, Next.js surfaces, Tauri desktop, Drizzle/Postgres, Redis.

## Context diagram

```text
Builders / Approvers / End users
        │
        ├─ control-plane-web ──┐
        ├─ agent-web-runtime ──┼──► apps/api (control plane + Agent Gateway)
        ├─ embed-runtime ──────┤         │
        └─ desktop-shell ──────┘         ├─ PostgreSQL
                                         ├─ Redis (queues, rate limits, lockout)
                                         └─ RuntimeProviderRegistry
                                                ├─ Claude Managed Agents
                                                └─ Local (dev only)
                          apps/worker ──────────┘
```

## Bounded contexts

| Context | Responsibility |
| --- | --- |
| Identity & tenancy | Users, orgs, memberships, sessions |
| Authorization | Roles, permissions, server-side checks |
| Agent management | Definitions, drafts, lifecycle |
| Versioning & approvals | Immutable versions, SoD decisions |
| Runtime | Adapters, deployments, sessions, events |
| Applications | Branding, publications, hosted routes |
| Observability | Audit, usage, correlation IDs, metrics, OTel |

## Design posture

- **Fail closed** on missing Anthropic keys, partial OIDC, and local runtime in production
- **Split secrets**: Next.js services do not receive `SECRETS_MASTER_KEY`
- **Publication scope**: embed/API tokens are runtime-only

Deeper notes: [`docs/architecture/`](https://github.com/AnkitParekh007/agent-studio/tree/main/docs/architecture).
