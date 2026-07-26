# Secrets

## Rules

- Never commit secrets or put them in `.env` committed files (use `.env.example` placeholders).
- Never return secret values to browser or desktop clients.
- Domain tables store `secret_references` (id, name, purpose), not plaintext.
- Values live in `secret_values`, encrypted with AES-256-GCM (`SECRETS_MASTER_KEY`, SHA-256-derived key).
- Logs and errors must run through redaction utilities before persistence/emission.

## API

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/secrets` | `governance:manage` | Metadata only |
| `POST` | `/api/secrets` | `governance:manage` | Body: `{ name, purpose, value }` — value never echoed |
| `POST` | `/api/secrets/:id/rotate` | `governance:manage` | Body: `{ value }` |

## Resolution

Only trusted server-side code may call `SecretsService.resolve(organizationId, secretId)`. There is **no** HTTP endpoint that returns plaintext.

MCP catalog entries may point at a `secretReferenceId`; runtime MCP transport wiring is still future work.
