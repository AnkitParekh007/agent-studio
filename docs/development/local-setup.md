# Local setup

1. Install Node 20+, pnpm 8.7+, Docker.
2. `cp .env.example .env` and set `BETTER_AUTH_SECRET` / `SECRETS_MASTER_KEY`.
3. `docker compose up -d` (Postgres on host port **55446**, Redis on **6380** by default to avoid collisions).
4. `pnpm install`
5. `pnpm db:migrate`
6. `pnpm db:seed` (blocked in production)
7. `pnpm dev`

Seed credentials are printed by the seed command and documented in the root README.

Optional API smokes (API + worker must be running):

```bash
pnpm smoke
pnpm smoke:playground
pnpm smoke:application-studio
```
