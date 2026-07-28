# Publish anywhere

One approved version, four channels.

| Channel | Surface |
| --- | --- |
| `hosted_web` | `agent-web-runtime` full app |
| `embed` | `embed-runtime` iframe + SDK |
| `api` | `/api/v1` with publication token |
| `desktop` | Tauri shell + updater path |

## Publication security properties

- **Tokens**: `pub_…` for runtime; never login sessions for builders.
- **Embed origins**: per-publication `allowedOrigins` → CSP `frame-ancestors`.
- **Token delivery**: postMessage after origin check — not query strings.
- **AuthZ**: publication tokens cannot exercise privileged operator APIs.

## Application Studio

Templates + branding live above the agent identity. The agent is the brain; the application is the product shell. See [Application Studio](application-studio.md).
