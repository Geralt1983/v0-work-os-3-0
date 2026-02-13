CREATE TABLE IF NOT EXISTS "notebooks" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Seed default notebooks (id is the key used for filing/routing).
INSERT INTO "notebooks" ("id", "label")
VALUES
  ('general', 'General'),
  ('work', 'Work'),
  ('personal', 'Personal')
ON CONFLICT ("id") DO NOTHING;

