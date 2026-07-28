# Publish to embed and API

Same approved version, two more surfaces: an iframe copilot and a machine-facing API.

## Preconditions

- Completed [Ship your first governed agent](first-agent.md)
- Application already created for the agent

## Publish channels

From the application detail page (or API), publish:

| Channel | Consumer |
| --- | --- |
| `hosted_web` | Full-page agent app |
| `embed` | Iframe / SDK parent page |
| `api` | Server-to-server / public API clients |
| `desktop` | Tauri desktop shell |

## Mint a publication token

Create a token on the embed (or API) publication. Tokens look like `pub_…`.

> [!DANGER]
> Never put publication tokens in iframe URLs. Agent Studio delivers embed tokens via **origin-checked `postMessage`** after handshake. URL tokens are a security defect.

## Embed checklist

1. Set `allowedOrigins` on the publication to your parent site origins.
2. Embed runtime derives CSP `frame-ancestors` from that allowlist (default deny).
3. Parent listens for the postMessage token; SDK attaches it to gateway calls.

## API checklist

```http
POST /api/v1/...
Authorization: Bearer pub_...
# or
x-publication-token: pub_...
```

Publication tokens map to an `end_user` runtime role. They must **not** call privileged surfaces (for example MCP admin/call paths reserved for operators). `pnpm smoke:authz` asserts these denials.

## Automated walk

Against a running stack (Claude in production Compose):

```bash
CONTROL_PLANE_ORIGIN=http://localhost:3000 SMOKE_RUNTIME_PROVIDER=claude \
  pnpm smoke:publish-channels
```

## Done when

- [ ] All four channels show active publications (or the subset you need)
- [ ] Embed loads only from allowlisted parents
- [ ] API session works with `pub_` bearer
- [ ] Privileged routes reject the publication token
