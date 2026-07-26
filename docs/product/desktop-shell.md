# Desktop shell

Phase 6 ships a Tauri 2 desktop client that opens **published** Agent Studio applications.

## User flow

1. Sign in with platform credentials.
2. Choose organization and enter a published application slug.
3. Chat with the agent through the Agent Gateway.

## Trust boundaries

| In the shell | Never in the shell |
| --- | --- |
| Session cookie (keychain) | `ANTHROPIC_API_KEY` |
| Public branding / studio config | MCP secrets |
| Gateway session ids | `SECRETS_MASTER_KEY` / admin tokens |

## Surfaces

- Native: `pnpm desktop:dev` (Tauri + Vite on `:1420`)
- UI preview: Vite-only `pnpm --filter @agent-studio/desktop-shell dev`
- Package: `pnpm desktop:build` (NSIS + updater artifacts)

Shipping details (signing, updater pubkey, CDN endpoints): `docs/operations/desktop-releases.md`.
