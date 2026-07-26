import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { publications } from './runtime.js';
import { organizations } from './tenancy.js';
import { users } from './auth.js';

export const organizationSettings = pgTable('organization_settings', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  maxUsdMonthly: text('max_usd_monthly'),
  maxConcurrentSessions: integer('max_concurrent_sessions'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const publicationTokens = pgTable(
  'publication_tokens',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    publicationId: text('publication_id')
      .notNull()
      .references(() => publications.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('default'),
    tokenHash: text('token_hash').notNull(),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('publication_tokens_hash_idx').on(t.tokenHash)],
);

export const organizationInvites = pgTable(
  'organization_invites',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    roleKey: text('role_key').notNull(),
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: text('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('organization_invites_hash_idx').on(t.tokenHash)],
);
