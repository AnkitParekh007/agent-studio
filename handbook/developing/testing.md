# Testing & smokes

Unit/integration tests live beside packages (`vitest`). API **smokes** exercise a running stack.

| Script | Intent |
| --- | --- |
| `pnpm smoke` | Vertical slice |
| `pnpm smoke:playground` | Playground stream |
| `pnpm smoke:application-studio` | App studio path |
| `pnpm smoke:governance` | Skills/MCP/budgets |
| `pnpm smoke:publish-channels` | Multi-channel publish |
| `pnpm smoke:deploy` | Prod Compose health |
| `pnpm smoke:authz` | Negative AuthZ (must hard-fail on miss) |

Production CI boots real `docker-compose.prod.yml` with a Claude HTTP double so the production path runs without live Anthropic credentials.

> [!NOTE]
> For Claude-backed local/prod smokes, set `SMOKE_RUNTIME_PROVIDER=claude` and a valid `CONTROL_PLANE_ORIGIN`.
