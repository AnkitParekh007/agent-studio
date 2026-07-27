# Backups and restore

Scope: the production Compose stack (`docker-compose.prod.yml`). Postgres holds all durable
state; Redis holds queues and gateway rate-limit counters and is persisted (AOF on the
`agentstudio_prod_redis` volume) but is not part of the recovery contract.

## Take a backup

```bash
pnpm backup:db          # writes ./backups/agentstudio-<timestamp>.sql.gz
node scripts/backup-postgres.mjs --out /mnt/backups
```

The script shells out to `docker compose exec -T postgres pg_dump` and gzips the stream, so it
works the same on Windows, macOS, and Linux. Credentials are read from `.env.production`.

Schedule it (cron / Task Scheduler) at least daily and ship the output off-host. Backups contain
encrypted secret values but **not** `SECRETS_MASTER_KEY` — store that key separately or the dump
is unrecoverable.

## Restore

1. Stop the app services so nothing writes during the restore:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production stop api worker control-plane-web agent-web-runtime embed-runtime
```

2. Load the dump (it is created with `--clean --if-exists`, so it drops and recreates objects):

```bash
gunzip -c backups/agentstudio-<timestamp>.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  psql -U agentstudio -d agentstudio
```

On Windows PowerShell:

```powershell
node -e "require('zlib').createGunzip().pipe(process.stdout); require('fs').createReadStream('backups/agentstudio-<timestamp>.sql.gz').pipe(require('zlib').createGunzip()).pipe(process.stdout)" | docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres psql -U agentstudio -d agentstudio
```

3. Apply any migrations newer than the dump and restart:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

4. Verify: `curl -fsS http://localhost:4000/health`, sign in to the control plane, and confirm an
   approved agent version still resolves.

## Retention

Runtime telemetry is trimmed separately from backups. Each org has `retentionDays`
(`PATCH /api/orgs/current/settings`), defaulting to `DATA_RETENTION_DAYS`. Trigger a purge with
`POST /api/orgs/current/retention/purge` (requires `org:manage`); it deletes runtime events, usage
records, and ended sessions past the window.
