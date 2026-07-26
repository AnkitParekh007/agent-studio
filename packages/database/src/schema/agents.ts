import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { organizations, workspaces } from './tenancy.js';

export const agentDefinitions = pgTable(
  'agent_definitions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    icon: text('icon'),
    category: text('category').default('general'),
    tags: text('tags').notNull().default('[]'),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    visibility: text('visibility').notNull().default('organization'),
    lifecycleStatus: text('lifecycle_status').notNull().default('draft'),
    currentDraftVersionId: text('current_draft_version_id'),
    currentApprovedVersionId: text('current_approved_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('agents_org_slug_idx').on(t.organizationId, t.slug)],
);

export const agentVersions = pgTable(
  'agent_versions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: text('status').notNull().default('draft'),
    configJson: text('config_json').notNull(),
    composedInstructions: text('composed_instructions').notNull().default(''),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    optimisticLock: integer('optimistic_lock').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('agent_versions_agent_number_idx').on(t.agentId, t.versionNumber)],
);

export const agentVersionTransitions = pgTable('agent_version_transitions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
  versionId: text('version_id')
    .notNull()
    .references(() => agentVersions.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const approvalRequests = pgTable('approval_requests', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
  versionId: text('version_id')
    .notNull()
    .references(() => agentVersions.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  submittedByUserId: text('submitted_by_user_id')
    .notNull()
    .references(() => users.id),
  baselineVersionId: text('baseline_version_id').references(() => agentVersions.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const approvalDecisions = pgTable('approval_decisions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  approvalRequestId: text('approval_request_id')
    .notNull()
    .references(() => approvalRequests.id, { onDelete: 'cascade' }),
  decision: text('decision').notNull(),
  reason: text('reason'),
  decidedByUserId: text('decided_by_user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
