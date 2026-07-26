ALTER TABLE "application_definitions" ADD COLUMN IF NOT EXISTS "template_key" text DEFAULT 'general_assistant' NOT NULL;
ALTER TABLE "application_definitions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft' NOT NULL;
ALTER TABLE "application_definitions" ADD COLUMN IF NOT EXISTS "studio_config_json" text DEFAULT '{}' NOT NULL;
