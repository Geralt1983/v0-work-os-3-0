-- Add missing last_task_description column to client_memory table
-- This column was in the schema but might be missing from databases created before the migration

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'client_memory'
        AND column_name = 'last_task_description'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "last_task_description" text;
    END IF;
END $$;
