# Testing

- **Unit** — Vitest in `packages/*` for state machines, RBAC, redaction, event normalization.
- **Contract** — Claude adapter against HTTP doubles.
- **Integration** — API + Postgres when available (`DATABASE_URL`).
- **E2E** — Playwright path planned after UI stabilizes; first slice covers API-level vertical flow tests.

Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
