# Governance (Phase 7)

Org-scoped controls for skills, MCP, knowledge, budgets, tool permissions, and evals.

## Skills

Reusable prompt fragments (+ optional tool name hints) attached to agent versions via `skillIds`.

## MCP servers

Org catalog of MCP endpoints. Optional `secretReferenceId` links credentials that **never** appear in public app or desktop payloads. Versions attach servers by id (`mcpServerIds`).

## Knowledge sources

Registered URI/refs for retrieval policy. Attached via `knowledgeSourceIds` and folded into server-side instructions at provision/playground time.

## Budgets & tools

Version config fields:

- `budgets.maxTokens` / `budgets.maxUsd` — enforced during gateway streaming on session usage
- `toolPermissions` — allowlist (`*` or empty = allow all)
- `runtimeLimits.maxToolCalls` — hard cap per session

Violations emit `error` events, audit records (`session.policy_denied` / `session.budget_exceeded`), and cancel the runtime session.

## Evals

Suites of prompt cases with `expectContains` scoring. Runs execute through the playground/runtime path and store pass/fail results.
