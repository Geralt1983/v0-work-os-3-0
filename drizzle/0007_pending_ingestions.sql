CREATE TABLE IF NOT EXISTS "pending_ingestions" (
  "id" text PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "source" text NOT NULL,
  "session_id" text,
  "content" text NOT NULL,
  "extracted_title" text NOT NULL,
  "suggested_notebook_id" text NOT NULL,
  "suggested_notebook_confidence" numeric(5, 4) NOT NULL,
  "final_notebook_id" text,
  "attachments" jsonb DEFAULT '[]'::jsonb,
  "source_metadata" jsonb DEFAULT '{}'::jsonb,
  "decision_reason" text,
  "decided_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pending_ingestions_status_idx" ON "pending_ingestions" ("status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pending_ingestions_source_idx" ON "pending_ingestions" ("source");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pending_ingestions_created_at_idx" ON "pending_ingestions" ("created_at");

