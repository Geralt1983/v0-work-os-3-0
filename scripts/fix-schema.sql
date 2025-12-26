-- Fix missing schema elements for WorkOS

-- Create task_graveyard table if not exists (or rename from move_graveyard)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'move_graveyard') THEN
        -- Rename old table
        ALTER TABLE move_graveyard RENAME TO task_graveyard;
    ELSIF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_graveyard') THEN
        -- Create new table
        CREATE TABLE task_graveyard (
            id SERIAL PRIMARY KEY,
            original_task_id INTEGER,
            client_id INTEGER REFERENCES clients(id),
            title VARCHAR(500) NOT NULL,
            description TEXT,
            effort_estimate INTEGER,
            drain_type VARCHAR(50),
            archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            archive_reason VARCHAR(50) DEFAULT 'auto_decay',
            original_created_at TIMESTAMP WITH TIME ZONE,
            days_in_backlog INTEGER
        );
    END IF;
END $$;

-- Add last_task_id column to client_memory if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'last_task_id'
    ) THEN
        ALTER TABLE client_memory ADD COLUMN last_task_id TEXT;
    END IF;
END $$;

-- Create daily_goals table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_goals') THEN
        CREATE TABLE daily_goals (
            id SERIAL PRIMARY KEY,
            date DATE UNIQUE NOT NULL,
            target_points INTEGER DEFAULT 18,
            earned_points INTEGER DEFAULT 0,
            task_count INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_goal_hit_date DATE,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Create behavioral_patterns table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'behavioral_patterns') THEN
        CREATE TABLE behavioral_patterns (
            id SERIAL PRIMARY KEY,
            pattern_type VARCHAR(50) NOT NULL,
            pattern_key VARCHAR(100) NOT NULL,
            pattern_value JSONB NOT NULL,
            confidence DECIMAL(3,2) DEFAULT 0.5,
            sample_size INTEGER DEFAULT 0,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Create task_events table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_events') THEN
        CREATE TABLE task_events (
            id SERIAL PRIMARY KEY,
            task_id INTEGER NOT NULL REFERENCES tasks(id),
            event_type VARCHAR(50) NOT NULL,
            from_status VARCHAR(50),
            to_status VARCHAR(50),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;
