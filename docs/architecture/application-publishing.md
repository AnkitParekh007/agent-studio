# Application publishing

Approved agents become application definitions with branding and chat settings, then publications.

## Hosted web (MVP)

Stable route:

`http://localhost:3001/{organizationSlug}/{applicationSlug}`

The hosted runtime loads **public** application config only (name, theme, welcome message, starter prompts). It never receives provider keys, MCP credentials, or admin tokens.

All chat traffic goes through the Agent Gateway with short-lived session authorization.

## Later surfaces

- Embedded copilot SDK with short-lived tokens
- Tauri 2 desktop shell loading authorized app definitions
- Versioned public API/SDK

## Custom domains

Designed for later; MVP uses platform hostname + org/app slugs.
