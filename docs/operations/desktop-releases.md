# Desktop releases

Tauri 2 Windows shell lives in `apps/desktop-shell`.

## What the shell does

- Authenticates against the platform (`POST /api/auth/sign-in/email`)
- Stores the session cookie in the **OS keychain** (Windows Credential Manager via the `keyring` crate)
- Loads authorized public application definitions (`GET /api/public/apps/:org/:app`)
- Streams chat through the Agent Gateway (`/api/gateway/sessions*`)
- Never receives provider keys, MCP credentials, or admin tokens
- Ships with **NSIS bundling** and **tauri-plugin-updater** enabled

Authenticated HTTP from the WebView goes through Rust commands so the session cookie can be attached safely (browsers forbid setting `Cookie` from JS).

## Local development

Prerequisites on Windows:

- Node 20+, pnpm
- Rust toolchain (`rustup default stable`)
- **MSVC linker** — Visual Studio 2022 Build Tools with the “Desktop development with C++” workload (`link.exe` on PATH)

```bash
pnpm desktop:dev
```

Frontend-only (no native keychain; session kept in `sessionStorage`):

```bash
pnpm --filter @agent-studio/desktop-shell dev
```

Add desktop origins to `CORS_ORIGINS` / Better Auth trusted origins:

`http://localhost:1420`, `tauri://localhost`, `https://tauri.localhost`

## Packaging

```bash
pnpm desktop:build
```

Produces an NSIS installer under `apps/desktop-shell/src-tauri/target/release/bundle/`.

`bundle.active` is **true**. Before production:

1. Set `bundle.windows.certificateThumbprint` to your Authenticode cert thumbprint (or sign in CI after build).
2. Replace the updater `pubkey` in `tauri.conf.json` with your real minisign/ed25519 public key from `tauri signer generate`.
3. Point `plugins.updater.endpoints` at your release CDN that serves Tauri update JSON + artifacts.
4. Expand CSP / capabilities HTTP allowlists for production API hosts.

## Auto-update

Updater plugin is registered. Frontend can call:

```ts
import { check } from '@tauri-apps/plugin-updater';
const update = await check();
```

Until endpoints serve signed manifests matching the configured pubkey, `check()` will fail closed (no update).

## Smoke

```bash
pnpm smoke:desktop
```

API-level path (does not launch Tauri).
