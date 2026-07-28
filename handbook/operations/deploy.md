# Production deploy

```bash
cp .env.production.example .env.production
# fill secrets, Anthropic, METRICS_BEARER_TOKEN
pnpm check:prod-env
pnpm deploy:up
pnpm smoke:deploy
```

## Services

| Service | Role |
| --- | --- |
| postgres / redis | Durable state + queues |
| migrate | One-shot Drizzle |
| api | Control plane + gateway |
| worker | Provision + retention |
| control-plane-web / agent-web-runtime / embed-runtime | Next surfaces |
| caddy | TLS front door `:443` |

Backend image runs as `USER node`. Demo seed is an opt-in Compose profile — never default production.

Guide: [Run a production pilot](../guides/pilot.md).
