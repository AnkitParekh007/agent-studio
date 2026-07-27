import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { agentDefinitions, agentVersions } from './agents.js';
import { organizations } from './tenancy.js';

export const agentDeployments = pgTable('agent_deployments', {
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
  runtimeProvider: text('runtime_provider').notNull(),
  status: text('status').notNull().default('pending'),
  providerAgentId: text('provider_agent_id'),
  providerEnvironmentId: text('provider_environment_id'),
  providerDeploymentId: text('provider_deployment_id'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const applicationDefinitions = pgTable(
  'application_definitions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    logoUrl: text('logo_url'),
    templateKey: text('template_key').notNull().default('general_assistant'),
    status: text('status').notNull().default('draft'),
    themeJson: text('theme_json').notNull().default('{}'),
    welcomeMessage: text('welcome_message').notNull().default('How can I help you today?'),
    starterPromptsJson: text('starter_prompts_json').notNull().default('[]'),
    studioConfigJson: text('studio_config_json').notNull().default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('apps_org_slug_idx').on(t.organizationId, t.slug)],
);

export const publications = pgTable('publications', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  applicationId: text('application_id')
    .notNull()
    .references(() => applicationDefinitions.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
  versionId: text('version_id')
    .notNull()
    .references(() => agentVersions.id, { onDelete: 'cascade' }),
  deploymentId: text('deployment_id').references(() => agentDeployments.id),
  channel: text('channel').notNull().default('hosted_web'),
  status: text('status').notNull().default('active'),
  /** JSON string array of allowed parent origins for embed framing + postMessage token delivery. Empty = deny. */
  allowedOriginsJson: text('allowed_origins_json').notNull().default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const runtimeSessions = pgTable('runtime_sessions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  publicationId: text('publication_id').references(() => publications.id, {
    onDelete: 'set null',
  }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: 'cascade' }),
  versionId: text('version_id')
    .notNull()
    .references(() => agentVersions.id, { onDelete: 'cascade' }),
  deploymentId: text('deployment_id').references(() => agentDeployments.id),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  runtimeProvider: text('runtime_provider').notNull(),
  providerSessionId: text('provider_session_id'),
  status: text('status').notNull().default('active'),
  correlationId: text('correlation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const runtimeEvents = pgTable('runtime_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  sessionId: text('session_id')
    .notNull()
    .references(() => runtimeSessions.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  type: text('type').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  providerEventId: text('provider_event_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usageRecords = pgTable('usage_records', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => runtimeSessions.id, { onDelete: 'set null' }),
  agentId: text('agent_id').references(() => agentDefinitions.id, { onDelete: 'set null' }),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  toolCallCount: integer('tool_call_count').notNull().default(0),
  estimatedCostUsd: text('estimated_cost_usd').notNull().default('0'),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
