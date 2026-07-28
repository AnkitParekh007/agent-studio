# Secrets

Server-side secret store (AES-256-GCM) behind `/api/secrets`. Resolution stays on the server — clients receive handles, not plaintext provider keys.

## Production split

Compose injects `BETTER_AUTH_SECRET`, `SECRETS_MASTER_KEY`, and `ANTHROPIC_API_KEY` into **api / worker / migrate** only. Next.js images get public URLs.

> [!DANGER]
> Backups contain encrypted secret values but **not** `SECRETS_MASTER_KEY`. Lose the master key and the dump is unrecoverable ciphertext.
