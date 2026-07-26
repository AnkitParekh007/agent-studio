CREATE TABLE IF NOT EXISTS "organization_settings" (
  "organization_id" text PRIMARY KEY NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "max_usd_monthly" text,
  "max_concurrent_sessions" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "publication_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "publication_id" text NOT NULL REFERENCES "publications"("id") ON DELETE cascade,
  "name" text DEFAULT 'default' NOT NULL,
  "token_hash" text NOT NULL,
  "created_by_user_id" text REFERENCES "users"("id") ON DELETE set null,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "publication_tokens_hash_idx" ON "publication_tokens" ("token_hash");

CREATE TABLE IF NOT EXISTS "organization_invites" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "role_key" text NOT NULL,
  "token_hash" text NOT NULL,
  "invited_by_user_id" text REFERENCES "users"("id") ON DELETE set null,
  "accepted_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "organization_invites_hash_idx" ON "organization_invites" ("token_hash");
