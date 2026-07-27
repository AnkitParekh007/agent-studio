ALTER TABLE "publications" ADD COLUMN IF NOT EXISTS "allowed_origins_json" text DEFAULT '[]' NOT NULL;

ALTER TABLE "organization_settings" ADD COLUMN IF NOT EXISTS "retention_days" integer DEFAULT 90;
