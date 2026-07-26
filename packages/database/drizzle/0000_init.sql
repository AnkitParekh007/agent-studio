CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_org_slug_idx" ON "workspaces" ("organization_id","slug");

CREATE TABLE IF NOT EXISTS "memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_org_user_idx" ON "memberships" ("organization_id","user_id");

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text REFERENCES "organizations"("id") ON DELETE set null,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE set null,
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text,
  "correlation_id" text,
  "metadata" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "secret_references" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "purpose" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "secret_values" (
  "secret_reference_id" text PRIMARY KEY NOT NULL REFERENCES "secret_references"("id") ON DELETE cascade,
  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "agent_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "icon" text,
  "category" text DEFAULT 'general',
  "tags" text DEFAULT '[]' NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES "users"("id"),
  "visibility" text DEFAULT 'organization' NOT NULL,
  "lifecycle_status" text DEFAULT 'draft' NOT NULL,
  "current_draft_version_id" text,
  "current_approved_version_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "agents_org_slug_idx" ON "agent_definitions" ("organization_id","slug");

CREATE TABLE IF NOT EXISTS "agent_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "version_number" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "config_json" text NOT NULL,
  "composed_instructions" text DEFAULT '' NOT NULL,
  "created_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "optimistic_lock" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "rejected_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_versions_agent_number_idx" ON "agent_versions" ("agent_id","version_number");

CREATE TABLE IF NOT EXISTS "agent_version_transitions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "version_id" text NOT NULL REFERENCES "agent_versions"("id") ON DELETE cascade,
  "from_status" text NOT NULL,
  "to_status" text NOT NULL,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE set null,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "version_id" text NOT NULL REFERENCES "agent_versions"("id") ON DELETE cascade,
  "status" text DEFAULT 'pending' NOT NULL,
  "submitted_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "baseline_version_id" text REFERENCES "agent_versions"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "approval_decisions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "approval_request_id" text NOT NULL REFERENCES "approval_requests"("id") ON DELETE cascade,
  "decision" text NOT NULL,
  "reason" text,
  "decided_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "agent_deployments" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "version_id" text NOT NULL REFERENCES "agent_versions"("id") ON DELETE cascade,
  "runtime_provider" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "provider_agent_id" text,
  "provider_environment_id" text,
  "provider_deployment_id" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "application_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "logo_url" text,
  "theme_json" text DEFAULT '{}' NOT NULL,
  "welcome_message" text DEFAULT 'How can I help you today?' NOT NULL,
  "starter_prompts_json" text DEFAULT '[]' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "apps_org_slug_idx" ON "application_definitions" ("organization_id","slug");

CREATE TABLE IF NOT EXISTS "publications" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "application_id" text NOT NULL REFERENCES "application_definitions"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "version_id" text NOT NULL REFERENCES "agent_versions"("id") ON DELETE cascade,
  "deployment_id" text REFERENCES "agent_deployments"("id"),
  "channel" text DEFAULT 'hosted_web' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "runtime_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "publication_id" text REFERENCES "publications"("id") ON DELETE set null,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "version_id" text NOT NULL REFERENCES "agent_versions"("id") ON DELETE cascade,
  "deployment_id" text REFERENCES "agent_deployments"("id"),
  "user_id" text REFERENCES "users"("id") ON DELETE set null,
  "runtime_provider" text NOT NULL,
  "provider_session_id" text,
  "status" text DEFAULT 'active' NOT NULL,
  "correlation_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "runtime_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "session_id" text NOT NULL REFERENCES "runtime_sessions"("id") ON DELETE cascade,
  "sequence" integer NOT NULL,
  "type" text NOT NULL,
  "payload_json" text DEFAULT '{}' NOT NULL,
  "provider_event_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "usage_records" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "session_id" text REFERENCES "runtime_sessions"("id") ON DELETE set null,
  "agent_id" text REFERENCES "agent_definitions"("id") ON DELETE set null,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "tool_call_count" integer DEFAULT 0 NOT NULL,
  "estimated_cost_usd" text DEFAULT '0' NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
