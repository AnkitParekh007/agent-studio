# Agent Studio

Enterprise Agent Application Factory: define an agent once, govern it centrally, and publish it as a secure web application, desktop shell, embedded copilot, or API.

Claude Managed Agents is the first execution provider. The domain model stays provider-neutral through an `AgentRuntimeAdapter` boundary.

## Quick start

```bash
# Prerequisites: Node 20+, pnpm 8.7+, Docker
cp .env.example .env
docker compose up -d   # Postgres :55446, Redis :6380
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Control plane: http://localhost:3000
- Hosted agent apps: http://localhost:3001
- API + Agent Gateway: http://localhost:4000

Default seed user (development only):

- Email: `owner@example.com`
- Password: `Password123!`

## Workspace

| Path | Purpose |
| --- | --- |
| `apps/control-plane-web` | Builder, playground, Application Studio, reviews |
| `apps/agent-web-runtime` | Hosted published applications |
| `apps/api` | NestJS control plane + Agent Gateway |
| `apps/worker` | BullMQ provision and background jobs |
| `packages/domain` | Types, lifecycle/version state machines |
| `packages/database` | Drizzle schema, migrations, seed |
| `packages/application-templates` | Studio templates + studioConfig schema |
| `packages/auth` | Better Auth configuration |
| `packages/authorization` | Server-side RBAC |
| `packages/runtime-core` | Adapter interface + event types |
| `packages/runtime-local` | Development-only runtime (explicit opt-in) |
| `packages/runtime-claude` | Claude Managed Agents adapter |
| `packages/config` | Zod environment validation |
| `packages/ui` | Shared UI primitives |

## Runtime providers

- `local` — deterministic streaming for demos. Requires `RUNTIME_ALLOW_LOCAL=true` and is **blocked in production**.
- `claude` — Anthropic Managed Agents (`managed-agents-2026-04-01`). Requires `ANTHROPIC_API_KEY`. Fails closed if unset. Never falls back to local silently.

## Documentation

See [`docs/`](docs/) for product vision, architecture, security, local setup, testing, deployment, and roadmap.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start API, worker, and web apps |
| `pnpm lint` / `typecheck` / `test` / `build` | Quality gates |
| `pnpm db:migrate` | Apply SQL migrations |
| `pnpm db:seed` | Load development seed data (refuses in production) |
| `pnpm smoke` / `smoke:playground` / `smoke:application-studio` | API smokes (stack must be running) |
