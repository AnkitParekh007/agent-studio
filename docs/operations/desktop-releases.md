# Desktop releases

Tauri 2 Windows shell: `apps/desktop-shell`.

## What ships

- Platform sign-in + OS keychain session
- Published app chat via Agent Gateway
- NSIS installer + updater artifacts (`bundle.active: true`)
- In-app **Check updates** (`@tauri-apps/plugin-updater`)

## Generate updater keys (once)

```bash
node scripts/generate-desktop-updater-keys.mjs
```

1. Copy the printed **public** key into `apps/desktop-shell/src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.
2. Store the private key contents in GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY` (optional password: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).
3. Point `plugins.updater.endpoints` at your CDN that serves Tauri update JSON + signed artifacts.

Private keys live under `.secrets/` (gitignored).

## Authenticode

Set `bundle.windows.certificateThumbprint` locally, or supply CI secrets:

- `WINDOWS_CERT_BASE64` — PFX bytes, base64
- `WINDOWS_CERT_PASSWORD`

Workflow: `.github/workflows/desktop-release.yml` (tag `desktop-v*` or manual dispatch).

## Build locally

```bash
pnpm desktop:build
```

Artifacts: `apps/desktop-shell/src-tauri/target/release/bundle/`.

## CSP / allowlists

Expand `tauri.conf.json` CSP `connect-src` and `capabilities/default.json` HTTP allowlist for production API + release CDN hosts.

## Smoke

```bash
pnpm smoke:desktop
pnpm smoke:publish-channels
```
