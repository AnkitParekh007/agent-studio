# Backups & retention

## Backups

```bash
pnpm backup:db                 # ./backups/*.sql.gz
pnpm backup:schedule --install # cron / Task Scheduler helper
pnpm backup:restore-drill      # safe restore into *_restore_drill
```

Ship dumps off-host. Store `SECRETS_MASTER_KEY` separately.

## Retention

- Default `DATA_RETENTION_DAYS=90`
- Worker purges on boot and every 24h
- On-demand: `POST /api/orgs/current/retention/purge`
- Export: `GET /api/orgs/current/export`
- Erasure: `DELETE /api/orgs/current` with matching `confirmSlug`
