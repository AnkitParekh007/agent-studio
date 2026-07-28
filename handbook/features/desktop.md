# Desktop Shell

`apps/desktop-shell` is a Tauri 2 client: OS keychain session storage + gateway chat against published agents.

## Release path

- NSIS installer (Windows) + updater UX
- Updater keys generated into `.secrets/` (never commit private keys)
- CI workflow can sign when `TAURI_SIGNING_PRIVATE_KEY` / Windows cert secrets are present

See repo `docs/operations/desktop-releases.md` and `docs/product/desktop-shell.md`.

```bash
pnpm desktop:dev
pnpm desktop:gen-updater-keys
```
