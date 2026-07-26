# Threat model (MVP baseline)

| Threat | Mitigation in first slice |
| --- | --- |
| Prompt injection | Instruction structure + tool risk classes (extend later) |
| Tool abuse | Server-side tool permission checks; high-risk requires approval |
| Malicious MCP | Server-side MCP config only; credentials never to clients |
| Secret exfiltration | Secret references + encrypted store; redaction helpers |
| Cross-tenant access | `organization_id` filters + RBAC on every route |
| Unsafe file access | Size/type limits (expand with uploads) |
| Desktop token theft | Deferred with Tauri secure storage |
| Supply-chain | Lockfile + CI; pin major deps |
| Webhook forgery | Deferred until Claude webhooks wired; verify signatures |
| Excessive spend | Budget fields on versions; enforcement hooks in gateway |
| Recursive subagents | Max depth fields reserved; orchestration later |

Full remediations continue across phases; MVP establishes isolation, RBAC, secrets, and gateway mediation.
