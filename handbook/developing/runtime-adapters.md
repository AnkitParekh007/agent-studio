# Runtime adapters

All model I/O crosses `AgentRuntimeAdapter` in `packages/runtime-core`.

| Package | Provider | Notes |
| --- | --- | --- |
| `runtime-local` | Deterministic local stream | Dev/demo; blocked in production |
| `runtime-claude` | Anthropic Managed Agents | Requires `ANTHROPIC_API_KEY` |

## Adapter duties

- Provision deployment for an approved version
- Start/cancel sessions
- Stream normalized runtime events
- Report usage estimates for budget enforcement

> [!TIP]
> Adding a provider should mean a new adapter package — not forks of tenancy, approvals, or publications.
