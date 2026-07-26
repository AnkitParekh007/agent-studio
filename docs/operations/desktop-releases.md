# Desktop releases

Tauri 2 Windows shell lives in `apps/desktop-shell`.

## What the shell does

- Authenticates against the platform (`POST /api/auth/sign-in/email`)
- Stores the session cookie in the **OS keychain** (Windows Credential Manager via the `keyring` crate)
- Loads authorized public application definitions (`GET /api/public/apps/:org/:app`)
- Streams chat through the Agent Gateway (`/api/gateway/sessions*`)
- Never receives provider keys, MCP credentials, or admin tokens

Authenticated HTTP from the WebView goes through Rust commands so the session cookie can be attached safely (browsers forbid setting `Cookie` from JS).

## Local development

Prerequisites on Windows:

- Node 20+, pnpm
- Rust toolchain (`rustup default stable`)
- **MSVC linker** — Visual Studio 2022 Build Tools with the “Desktop development with C++” workload (`link.exe` on PATH)

Without MSVC, the Vite frontend still builds (`pnpm --filter @agent-studio/desktop-shell build`); native `tauri:dev` / `tauri:build` will fail at link time.

```bash
# API + worker must already be running
pnpm --filter @agent-studio/desktop-shell tauri:dev
# or
pnpm desktop:dev
```

Frontend-only (no native keychain; session kept in `sessionStorage`):

```bash
pnpm --filter @agent-studio/desktop-shell dev
```

Add desktop origins to `CORS_ORIGINS` / Better Auth trusted origins:

`http://localhost:1420`, `tauri://localhost`, `https://tauri.localhost`

## Smoke

```bash
pnpm smoke:desktop
```

Exercises the same auth → public app → gateway stream path the shell uses (API-level; does not launch Tauri).

## Shipping (deferred)

Not enterprise-shipped yet:

- Code signing (Windows Authenticode / Apple notarization)
- Auto-update channels
- Store / MSI packaging (`bundle.active` is currently `false`)

Do not generate a unique source repository per agent. Prefer a single shell that loads publication-scoped apps via the Agent Gateway (session cookie or publication token).
