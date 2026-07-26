# Application publishing

Agent Studio publishes **per channel**. One application can be live on hosted web, embed, API, and desktop at the same time.

## Channels

| Channel | Consumer | Auth |
| --- | --- | --- |
| `hosted_web` | `apps/agent-web-runtime` (`:3001`) | Session cookie or `pub_` token |
| `embed` | `apps/embed-runtime` (`:3002`) + `@agent-studio/embed-sdk` | Prefer `pub_` token (`?token=`) |
| `api` | Any HTTP client via `/api/v1` | `pub_` token or session |
| `desktop` | `apps/desktop-shell` | Session (keychain) or token |

## Control-plane flow

1. Approve + provision an agent version.
2. Create/edit an application in Application Studio.
3. Publish each desired channel (`POST /api/applications/:id/publish` with `{ "channel": "embed" }`).
4. Mint a publication token for embed/API end users.
5. Unpublish a single channel without tearing down the others.

## Public config

`GET /api/public/apps/:orgSlug/:appSlug?channel=embed`

Returns branding + `publication.id` only — never secrets.

## Public API (v1)

See `GET /api/v1` for the live contract. Core calls:

- `POST /api/v1/sessions` `{ publicationId, message? }`
- `POST /api/v1/sessions/:id/stream` (SSE)

Headers: `x-organization-id` + `x-publication-token: pub_…`

## Embed SDK

```ts
import { AgentStudioEmbedClient, createEmbedIframe } from '@agent-studio/embed-sdk';

const client = new AgentStudioEmbedClient({
  apiBaseUrl: 'https://api.example.com',
  organizationId: 'org_…',
  publicationToken: 'pub_…',
});
await client.chat(publicationId, 'Hello');
```

Or mount an iframe to the embed runtime:

```ts
const iframe = createEmbedIframe({
  embedRuntimeOrigin: 'https://embed.example.com',
  orgSlug: 'acme',
  appSlug: 'support',
  publicationToken: 'pub_…',
});
document.body.appendChild(iframe);
```
