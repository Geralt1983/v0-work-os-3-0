ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "notebook_id" text DEFAULT 'general';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'chat' NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "source_metadata" jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS "messages_notebook_id_idx" ON "messages" ("notebook_id");
CREATE INDEX IF NOT EXISTS "messages_source_idx" ON "messages" ("source");
