# Agent Gateway

The Agent Gateway is the only door end-user surfaces should use to talk to models.

## Responsibilities

1. Authenticate (session cookie or publication token)
2. Authorize org + publication scope
3. Resolve the active approved version / deployment
4. Enforce rate limits, concurrency, budgets, timeouts
5. Stream events (SSE) and persist usage + audit signals

## Why a gateway (for AI)

If each app talks to Anthropic directly:

- Keys leak into browsers and mobile builds
- Spend cannot be capped centrally
- Tool calls bypass allowlists
- You cannot revoke a publication without rotating provider credentials

The gateway keeps **provider credentials server-side** and makes every session attributable.

## Hardening highlights

- Redis-backed rate limits (multi-replica safe)
- Atomic concurrency lease (exact release on end/cancel/timeout)
- Mid-session spend re-check on usage events
- CORS allowlists for browser surfaces

Related architecture: [Architecture](../developing/architecture.md).
