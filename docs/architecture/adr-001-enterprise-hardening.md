# ADR-001: Enterprise readiness hardening

## Status

Accepted (2026-07-26)

## Context

Phases 0–7 delivered a working vertical slice, but docs overstated “Completed,” secrets had schema without crypto usage, gateway SSE used `Access-Control-Allow-Origin: *`, hosted apps required control-plane cookies, and CI lacked Postgres/Redis.

## Decision

1. Keep roadmap language honest (“MVP slice” / “first pass”) and track hardening as explicit workstreams.
2. Encrypt secrets at rest (AES-256-GCM) with org-scoped APIs that never return plaintext.
3. Authenticate hosted runtime via short-lived publication tokens (`pub_…`) in addition to session cookies.
4. Enforce gateway allowlisted CORS, per-org rate limits, concurrency caps, monthly spend, and session timeouts.
5. Enforce separation of duties on approvals (`ALLOW_SELF_APPROVAL=false` by default).
6. Expose audit read + minimal Prometheus metrics; defer full OpenTelemetry.

## Consequences

- Hosted apps can chat without a platform login when given a publication token.
- Operators must migrate `0003_enterprise_hardening` and set `SECRETS_MASTER_KEY`.
- MCP/knowledge remain catalogs until a dedicated runtime integration workstream.
