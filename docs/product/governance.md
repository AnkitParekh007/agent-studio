# Governance (Phase 7)

Org-scoped controls for skills, MCP, knowledge, budgets, tool permissions, and evals.

**Honest scope:** Skills/MCP/knowledge are **catalogs** attached to versions. The gateway enforces tool allowlists and budgets today; it does **not** open live MCP transports or run a knowledge retrieval pipeline yet.

## Skills

Reusable prompt fragments (+ optional tool name hints) attached to agent versions via `skillIds`.

## MCP servers

Org catalog of MCP endpoints. Optional `secretReferenceId` links credentials stored via `/api/secrets` that **never** appear in public app or desktop payloads. Versions attach servers by id (`mcpServerIds`). Live MCP session bridging is future work.

## Knowledge sources

Registered URI/refs for retrieval policy. Attached via `knowledgeSourceIds` and folded into server-side instructions at provision/playground time. This is not a vector/RAG service yet.

## Budgets & tools

Version config fields:

- `budgets.maxTokens` / `budgets.maxUsd` — enforced during gateway streaming on session usage
- `toolPermissions` — allowlist (`*` or empty = allow all)
- `runtimeLimits.maxToolCalls` — hard cap per session

Org settings (`maxUsdMonthly`, `maxConcurrentSessions`) plus env rate limits further constrain the gateway.

Violations emit `error` events, audit records (`session.policy_denied` / `session.budget_exceeded`), and cancel the runtime session.

## Evals

Suites of prompt cases with `expectContains` scoring. Runs execute through the playground/runtime path and store pass/fail results.

## Audit

`GET /api/audit-events` (permission `audit:read`) lists recent org events with optional filters.
