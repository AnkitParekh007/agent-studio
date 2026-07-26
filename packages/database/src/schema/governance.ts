import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { agentDefinitions, agentVersions } from './agents.js';
import { organizations } from './tenancy.js';
import { users } from './auth.js';

export const skills = pgTable(
  'skills',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    promptFragment: text('prompt_fragment').notNull().default(''),
    toolNamesJson: text('tool_names_json').notNull().default('[]'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('skills_org_key_idx').on(t.organizationId, t.key)],
);

export const mcpServers = pgTable(
  'mcp_servers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    transport: text('transport').notNull().default('http'),
    endpointUrl: text('endpoint_url').notNull(),
    /** Optional secret_references.id — credentials never leave the server. */
    secretReferenceId: text('secret_reference_id'),
    metadataJson: text('metadata_json').notNull().default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('mcp_servers_org_key_idx').on(t.organizationId, t.key)],
);

export const knowledgeSources = pgTable(
  'knowledge_sources',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    sourceType: text('source_type').notNull().default('url'),
    uri: text('uri').notNull(),
    metadataJson: text('metadata_json').notNull().default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('knowledge_sources_org_key_idx').on(t.organizationId, t.key)],
);

export const evalSuites = pgTable(
  'eval_suites',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const evalCases = pgTable('eval_cases', {
  id: text('id').primaryKey(),
  suiteId: text('suite_id')
    .notNull()
    .references(() => evalSuites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  expectContains: text('expect_contains').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const evalRuns = pgTable('eval_runs', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  suiteId: text('suite_id')
    .notNull()
    .references(() => evalSuites.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
  versionId: text('version_id')
    .notNull()
    .references(() => agentVersions.id, { onDelete: 'cascade' }),
  triggeredByUserId: text('triggered_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  status: text('status').notNull().default('running'),
  passedCount: integer('passed_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  resultsJson: text('results_json').notNull().default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
