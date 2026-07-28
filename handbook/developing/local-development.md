# Local development

## Workspace map

| Path | Purpose |
| --- | --- |
| `apps/control-plane-web` | Builder UI |
| `apps/agent-web-runtime` | Hosted apps |
| `apps/embed-runtime` | Embed iframe runtime |
| `apps/api` | NestJS API + gateway |
| `apps/worker` | BullMQ jobs + retention |
| `apps/desktop-shell` | Tauri client |
| `packages/*` | Domain, DB, auth, runtimes, UI |

## Loop

```bash
docker compose up -d
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

See also [Getting Started](../overview/getting-started.md).
