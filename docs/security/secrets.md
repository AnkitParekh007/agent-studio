# Secrets

## Rules

- Never commit secrets or put them in `.env` committed files (use `.env.example` placeholders).
- Never return secret values to browser or desktop clients.
- Domain tables store `secret_references` (id, name, purpose), not plaintext.
- Values live in an encrypted secret store (AES-256-GCM with `SECRETS_MASTER_KEY`).
- Logs and errors must run through redaction utilities before persistence/emission.

## Resolution

Only trusted server-side code (API/worker/runtime adapters) may resolve a secret by id within the caller's organization.
