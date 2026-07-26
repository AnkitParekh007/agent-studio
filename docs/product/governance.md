# Governance

Org-scoped controls for skills, MCP, knowledge, budgets, tool permissions, and evals.

## Skills

Reusable prompt fragments (+ optional tool name hints) attached to agent versions via `skillIds`. Folded into instructions at provision and playground start.

## MCP servers (live)

Org catalog of MCP endpoints. Optional `secretReferenceId` links credentials from `/api/secrets` that **never** appear in public app or desktop payloads.

At provision and playground compose time the control plane:

1. Resolves the secret (if any)
2. Calls MCP `tools/list` over HTTP JSON-RPC
3. Injects the live tool catalog into instructions

On the **local** runtime, users can invoke tools with:

```text
mcp:<serverKey>.<toolName> {"arg":"value"}
```

That path runs server-side via `RuntimeContextService` / `POST /api/integrations/mcp/call`. Credentials never leave the API.

Claude Managed Agents receive the tool catalog in the system prompt; native Claude↔MCP bridging remains provider-specific.

## Knowledge sources (live retrieval)

Registered URI/refs (`http(s)` or inline `text:…`). At provision/playground the server **fetches** content (size-capped) and injects it into instructions as retrieved knowledge—not only URI lists.

Operator probe: `POST /api/integrations/knowledge/retrieve`.

## Budgets & tools

Version config fields:

- `budgets.maxTokens` / `budgets.maxUsd` — enforced during gateway streaming on session usage
- `toolPermissions` — allowlist (`*` or empty = allow all)
- `runtimeLimits.maxToolCalls` — hard cap per session

Org settings (`maxUsdMonthly`, `maxConcurrentSessions`) plus env rate limits further constrain the gateway.

## Evals

Suites of prompt cases with `expectContains` scoring. Runs execute through the playground/runtime path and store pass/fail results.

## Audit

`GET /api/audit-events` (permission `audit:read`) lists recent org events with optional filters.
