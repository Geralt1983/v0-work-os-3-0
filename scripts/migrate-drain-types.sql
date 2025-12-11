-- Migration: Convert old drain types to new simplified types
-- deep stays as "deep"
-- comms, easy -> "shallow"
-- admin stays as "admin"
-- creative -> "deep"

-- Update moves table
UPDATE moves
SET drain_type = CASE
  WHEN drain_type = 'comms' THEN 'shallow'
  WHEN drain_type = 'easy' THEN 'shallow'
  WHEN drain_type = 'creative' THEN 'deep'
  ELSE drain_type
END
WHERE drain_type IN ('comms', 'easy', 'creative');

-- Update move_graveyard table
UPDATE move_graveyard
SET drain_type = CASE
  WHEN drain_type = 'comms' THEN 'shallow'
  WHEN drain_type = 'easy' THEN 'shallow'
  WHEN drain_type = 'creative' THEN 'deep'
  ELSE drain_type
END
WHERE drain_type IN ('comms', 'easy', 'creative');

-- Verify the migration
SELECT drain_type, COUNT(*) as count
FROM moves
WHERE drain_type IS NOT NULL
GROUP BY drain_type
ORDER BY drain_type;
