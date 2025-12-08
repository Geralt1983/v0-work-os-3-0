-- Add subtasks column to moves table
ALTER TABLE moves ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]';
