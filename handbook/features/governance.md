# Govern centrally

Governance is the difference between an AI experiment and an AI product line.

## Approvals & SoD

- Approval requests and decisions are first-class.
- Self-approval is disabled by default (`ALLOW_SELF_APPROVAL=false`).
- Seeded `approver@example.com` exists so local SoD is exercisable.

## RBAC

Server-side permissions via `@agent-studio/authorization`. Org membership is required; cross-org headers fail closed.

## Budgets & tools

Gateway enforces:

- Tool allowlists
- Per-agent / org spend signals (including mid-session re-checks)
- Concurrency caps (atomic Redis counters)
- Session timeouts

## Skills, MCP, knowledge

Governed catalogs — not unrestricted tool soup. See [Skills, MCP & Knowledge](integrations.md).

## Audit

Sensitive actions write audit events. Operators can read `GET /api/audit-events`. Tenant export and erasure are available for data lifecycle.

> [!NOTE]
> Governance is not a UI badge. If the gateway does not enforce it, it does not count.
