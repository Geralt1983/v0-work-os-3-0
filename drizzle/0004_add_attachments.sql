CREATE TABLE IF NOT EXISTS "message_attachments" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL REFERENCES "messages"("id"),
  "type" text NOT NULL,
  "name" text NOT NULL,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "url" text NOT NULL,
  "transcription" text,
  "duration_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
