# Testing

- **Unit** — Vitest in `packages/*` for state machines, RBAC, redaction, event normalization.
- **Contract** — Claude adapter against HTTP doubles.
- **Integration** — API + Postgres when available (`DATABASE_URL`).
- **E2E** — Playwright path planned after UI stabilizes; first slice covers API-level vertical flow tests.

Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

API smokes (with API + worker + Postgres + Redis up): `pnpm smoke`, `pnpm smoke:playground`, `pnpm smoke:application-studio`, `pnpm smoke:desktop`, `pnpm smoke:governance`, `pnpm smoke:enterprise`.

CI runs lint/typecheck/test/build, migrates against service containers, then `pnpm smoke` and `pnpm smoke:enterprise`.
