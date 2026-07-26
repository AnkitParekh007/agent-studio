# Runtime adapters

Documentation consulted: **2026-07-26** — [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview).

## Interface

`AgentRuntimeAdapter` (see `packages/runtime-core`) supports validate, provision/update/terminate deployment, start/stream/submit/approve/cancel session, and get usage.

## Registry

Providers are registered by name. Selection is explicit per agent version (`runtimeProvider`). Production never silently switches providers on failure.

## Local adapter (`runtime-local`)

- Purpose: deterministic development and CI without Anthropic credentials.
- Opt-in: `RUNTIME_ALLOW_LOCAL=true`.
- Hard-blocked when `NODE_ENV=production`.
- Clearly labeled in logs and UI as development-only.

## Claude adapter (`runtime-claude`)

- SDK: `@anthropic-ai/sdk` beta namespace.
- Beta header: `managed-agents-2026-04-01` (SDK-managed).
- Requires `ANTHROPIC_API_KEY`. Missing key → explicit configuration error.
- Mapping:
  - Internal agent version → Claude Agent (+ version pin when available)
  - Runtime environment → Claude Environment
  - Platform deployment → stored Claude agent/environment IDs
  - Gateway session → Claude Session
  - Normalized events ← Claude session SSE events
- Anthropic **Deployments** (cron) are out of MVP scope and must not be confused with platform publications.

## Activation

```bash
# Local demo
RUNTIME_ALLOW_LOCAL=true
DEFAULT_RUNTIME_PROVIDER=local

# Claude Managed Agents
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_RUNTIME_PROVIDER=claude
# RUNTIME_ALLOW_LOCAL can remain false
```

Contract tests use HTTP doubles; optional live smoke tests are excluded from default CI.
