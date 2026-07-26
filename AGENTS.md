# AGENTS.md

## Mission

Build and extend Agent Studio as a production-quality, provider-neutral Agent Application Factory.

## Before changing code

1. Read `README.md`, `CLAUDE.md`, and relevant docs under `docs/`.
2. Prefer the existing monorepo packages and NestJS modules.
3. Keep org isolation and RBAC checks on the server.
4. Route all provider execution through `packages/runtime-core`.

## Vertical slice priority

Create → configure → submit → approve → provision → publish hosted app → Gateway session → stream events → audit/usage.

## Testing

- Unit: lifecycle/version transitions, RBAC, secret redaction, event normalization.
- Contract: runtime adapter boundary with HTTP doubles for Claude.
- Integration: approval flow, gateway authz, org isolation when DB is available.
- Do not disable tests to get a green build.

## Secrets

Store only `secret_references` in domain rows. Resolve values server-side via the encrypted secret store. Redact secrets from logs and client payloads.
