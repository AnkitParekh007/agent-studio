CREATE TABLE IF NOT EXISTS "skills" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "prompt_fragment" text DEFAULT '' NOT NULL,
  "tool_names_json" text DEFAULT '[]' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "skills_org_key_idx" ON "skills" ("organization_id","key");

CREATE TABLE IF NOT EXISTS "mcp_servers" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "transport" text DEFAULT 'http' NOT NULL,
  "endpoint_url" text NOT NULL,
  "secret_reference_id" text,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_servers_org_key_idx" ON "mcp_servers" ("organization_id","key");

CREATE TABLE IF NOT EXISTS "knowledge_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "source_type" text DEFAULT 'url' NOT NULL,
  "uri" text NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_sources_org_key_idx" ON "knowledge_sources" ("organization_id","key");

CREATE TABLE IF NOT EXISTS "eval_suites" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "eval_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "suite_id" text NOT NULL REFERENCES "eval_suites"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "prompt" text NOT NULL,
  "expect_contains" text DEFAULT '' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "eval_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "suite_id" text NOT NULL REFERENCES "eval_suites"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE cascade,
  "version_id" text NOT NULL REFERENCES "agent_versions"("id") ON DELETE cascade,
  "triggered_by_user_id" text REFERENCES "users"("id") ON DELETE set null,
  "status" text DEFAULT 'running' NOT NULL,
  "passed_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "results_json" text DEFAULT '[]' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
