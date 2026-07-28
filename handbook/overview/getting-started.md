# Getting Started

Get a local Agent Studio stack running and open the control plane in minutes.

## Prerequisites

- Node.js **20+**
- pnpm **8.7+** (repo `packageManager`)
- Docker (Postgres + Redis)

## Boot the factory

```bash
cp .env.example .env
docker compose up -d          # Postgres :55446, Redis :6380
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

| Surface | URL |
| --- | --- |
| Control plane (builder) | http://localhost:3000 |
| Hosted agent apps | http://localhost:3001 |
| Embed runtime | http://localhost:3002 |
| API + Agent Gateway | http://localhost:4000 |

## Seed identities

Development seed only — never for production:

| Role | Email | Password |
| --- | --- | --- |
| Owner / builder | `owner@example.com` | `Password123!` |
| Approver (SoD) | `approver@example.com` | `Password123!` |

> [!WARNING]
> Separation of duties is on by default (`ALLOW_SELF_APPROVAL=false`). Submit as owner; approve as approver.

## Your first loop

1. Sign in to the control plane as **owner**.
2. Create an agent, set instructions, submit for review.
3. Sign in as **approver** and approve the version.
4. Wait for the worker to provision a deployment (`local` in dev, `claude` when configured).
5. Publish a hosted web application and open a session through the Agent Gateway.

Walk the full narrative in [Ship your first governed agent](../guides/first-agent.md).

## Runtime providers

| Provider | When to use |
| --- | --- |
| `local` | Deterministic streaming for demos. Requires `RUNTIME_ALLOW_LOCAL=true`. **Blocked when `NODE_ENV=production`.** |
| `claude` | Anthropic Managed Agents. Requires `ANTHROPIC_API_KEY`. Fails closed if unset. |

> [!DANGER]
> Production never silently falls back to the local adapter. If Claude is misconfigured, provisioning fails loudly.

## Next

- [What Is an Agent Application?](agent-application.md)
- [Local development](../developing/local-development.md) for monorepo layout
- [Production deploy](../operations/deploy.md) when you leave the laptop
