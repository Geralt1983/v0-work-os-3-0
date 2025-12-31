-- Add missing columns to client_memory table
-- These columns were in the schema but might be missing from databases created before the migration

-- Add last_task_description if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'last_task_description'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "last_task_description" text;
    END IF;
END $$;

-- Add last_task_at if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'last_task_at'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "last_task_at" timestamp;
    END IF;
END $$;

-- Add last_task_id if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'last_task_id'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "last_task_id" text;
    END IF;
END $$;

-- Add total_tasks if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'total_tasks'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "total_tasks" integer DEFAULT 0;
    END IF;
END $$;

-- Add stale_days if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'stale_days'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "stale_days" integer DEFAULT 0;
    END IF;
END $$;

-- Add notes if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'notes'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "notes" text;
    END IF;
END $$;

-- Add sentiment if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'sentiment'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "sentiment" text DEFAULT 'neutral';
    END IF;
END $$;

-- Add importance if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'importance'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "importance" text DEFAULT 'medium';
    END IF;
END $$;

-- Add preferred_work_time if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'preferred_work_time'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "preferred_work_time" text;
    END IF;
END $$;

-- Add avoidance_score if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'avoidance_score'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "avoidance_score" integer DEFAULT 0;
    END IF;
END $$;

-- Add tier if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'tier'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "tier" text DEFAULT 'active';
    END IF;
END $$;

-- Add created_at if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
    END IF;
END $$;

-- Add updated_at if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE "client_memory" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
    END IF;
END $$;
