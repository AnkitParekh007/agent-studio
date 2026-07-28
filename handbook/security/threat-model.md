# Threat model

Agent Studio assumes hostile clients and curious tenants.

## Trust boundaries

| Boundary | Rule |
| --- | --- |
| Browser / desktop | Never receives provider API keys or `SECRETS_MASTER_KEY` |
| Publication token | Runtime-only; no privileged operator APIs |
| Org header | Must match membership; cross-org denied |
| Embed parent | Must be in `allowedOrigins` |
| Outbound fetch | SSRF-guarded (knowledge + MCP) |
| Metrics | Bearer-protected |

## Abuse cases we design against

- Prompt/config edits silently reaching production (versions + approvals)
- Token-in-URL embed exfiltration (postMessage delivery)
- Auth credential stuffing (`/api/auth/*` rate limit + lockout)
- Gateway stampede (Redis rate limits + concurrency leases)
- Local adapter in production (hard block)

Repo depth: `docs/security/threat-model.md`.
