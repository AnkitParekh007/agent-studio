# Application publishing

Approved agents become **application definitions** with studio configuration, then **publications** on a channel (hosted web first).

## Application Studio

Control-plane Application Studio manages the lifecycle:

`draft` → edit branding/features → `published` (active hosted publication)

Templates live in `@agent-studio/application-templates` and seed `studio_config_json` (plus denormalized welcome/theme/starter columns for compatibility).

API surface:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/application-templates` | List templates |
| GET/POST | `/api/applications` | List / create draft |
| GET/PATCH | `/api/applications/:id` | Load / update studio config |
| POST | `/api/applications/:id/publish` | Publish hosted web |
| POST | `/api/applications/publish` | Legacy one-shot create+publish |
| GET | `/api/public/apps/:orgSlug/:appSlug` | Public branding + publication id |

## Hosted web

Stable route:

`http://localhost:3001/{organizationSlug}/{applicationSlug}`

The hosted runtime loads **public** application config only (name, theme, welcome message, starter prompts, feature flags, footer links). It never receives provider keys, MCP credentials, or admin tokens.

### End-user auth for hosted chat

Gateway calls accept either:

1. A Better Auth session cookie for an org member, or
2. A publication token (`x-publication-token: pub_…` or `Authorization: Bearer pub_…`) minted via `POST /api/publications/:publicationId/tokens`.

The hosted app reads `?token=pub_…` (stored in `sessionStorage`) and sends it on gateway requests. Tokens are hashed at rest and can be revoked.

All chat traffic goes through the Agent Gateway with short-lived session authorization.

## Later surfaces

- Embedded copilot SDK with short-lived tokens
- Tauri 2 desktop shell loading authorized app definitions
- Versioned public API/SDK

## Custom domains

Designed for later; MVP uses platform hostname + org/app slugs.
