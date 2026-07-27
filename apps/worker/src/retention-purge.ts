import {
  auditEvents,
  newId,
  organizationSettings,
  organizations,
  runtimeEvents,
  runtimeSessions,
  usageRecords,
  type Database,
} from '@agent-studio/database';
import { and, eq, isNotNull, lt } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes runtime telemetry past each organization's retention window.
 * Mirrors the on-demand `POST /api/orgs/current/retention/purge` endpoint so
 * retention holds without an operator remembering to press the button.
 */
export async function purgeExpiredTelemetry(db: Database, defaultRetentionDays: number) {
  const orgs = await db
    .select({
      organizationId: organizations.id,
      retentionDays: organizationSettings.retentionDays,
    })
    .from(organizations)
    .leftJoin(
      organizationSettings,
      eq(organizationSettings.organizationId, organizations.id),
    );

  const summary = { organizations: 0, runtimeEvents: 0, usageRecords: 0, runtimeSessions: 0 };

  for (const org of orgs) {
    const retentionDays = org.retentionDays ?? defaultRetentionDays;
    const cutoff = new Date(Date.now() - retentionDays * DAY_MS);

    const deletedEvents = await db
      .delete(runtimeEvents)
      .where(
        and(
          eq(runtimeEvents.organizationId, org.organizationId),
          lt(runtimeEvents.createdAt, cutoff),
        ),
      )
      .returning({ id: runtimeEvents.id });

    const deletedUsage = await db
      .delete(usageRecords)
      .where(
        and(
          eq(usageRecords.organizationId, org.organizationId),
          lt(usageRecords.createdAt, cutoff),
        ),
      )
      .returning({ id: usageRecords.id });

    const deletedSessions = await db
      .delete(runtimeSessions)
      .where(
        and(
          eq(runtimeSessions.organizationId, org.organizationId),
          isNotNull(runtimeSessions.endedAt),
          lt(runtimeSessions.endedAt, cutoff),
        ),
      )
      .returning({ id: runtimeSessions.id });

    const deleted = deletedEvents.length + deletedUsage.length + deletedSessions.length;
    if (deleted === 0) continue;

    summary.organizations += 1;
    summary.runtimeEvents += deletedEvents.length;
    summary.usageRecords += deletedUsage.length;
    summary.runtimeSessions += deletedSessions.length;

    await db.insert(auditEvents).values({
      id: newId('audit'),
      organizationId: org.organizationId,
      actorUserId: null,
      action: 'org.retention_purged',
      resourceType: 'organization',
      resourceId: org.organizationId,
      metadata: JSON.stringify({
        source: 'worker_schedule',
        retentionDays,
        cutoff: cutoff.toISOString(),
        deletedRuntimeEvents: deletedEvents.length,
        deletedUsageRecords: deletedUsage.length,
        deletedRuntimeSessions: deletedSessions.length,
      }),
    });
  }

  return summary;
}

/** Runs once on boot, then daily. Returns the timer so callers can clear it. */
export function scheduleRetentionPurge(
  db: Database,
  defaultRetentionDays: number,
  intervalMs = DAY_MS,
) {
  const run = () => {
    purgeExpiredTelemetry(db, defaultRetentionDays)
      .then((summary) => {
        console.log('Retention purge completed', summary);
      })
      .catch((err) => {
        console.error('Retention purge failed', err);
      });
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}
