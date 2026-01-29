import { neon } from "@neondatabase/serverless"

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("Usage: node scripts/migrate-moves-to-tasks.mjs <DATABASE_URL>")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function main() {
  console.log("=== Production Database Migration ===\n")
  console.log("Migrating from 'moves' schema to 'tasks' schema...\n")

  // 1. Rename moves → tasks
  console.log("1. Renaming tables...")

  try {
    await sql`ALTER TABLE IF EXISTS moves RENAME TO tasks`
    console.log("   ✓ moves → tasks")
  } catch (e) {
    console.log("   - moves table already renamed or doesn't exist")
  }

  try {
    await sql`ALTER TABLE IF EXISTS move_events RENAME TO task_events`
    console.log("   ✓ move_events → task_events")
  } catch (e) {
    console.log("   - move_events table already renamed or doesn't exist")
  }

  try {
    await sql`ALTER TABLE IF EXISTS move_graveyard RENAME TO task_graveyard`
    console.log("   ✓ move_graveyard → task_graveyard")
  } catch (e) {
    console.log("   - move_graveyard table already renamed or doesn't exist")
  }

  // 2. Add points columns to tasks
  console.log("\n2. Adding points columns to tasks...")

  try {
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS points_ai_guess integer`
    console.log("   ✓ Added points_ai_guess")
  } catch (e) {
    console.log("   - points_ai_guess already exists")
  }

  try {
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS points_final integer`
    console.log("   ✓ Added points_final")
  } catch (e) {
    console.log("   - points_final already exists")
  }

  try {
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS points_adjusted_at timestamp with time zone`
    console.log("   ✓ Added points_adjusted_at")
  } catch (e) {
    console.log("   - points_adjusted_at already exists")
  }

  // 3. Create daily_goals table
  console.log("\n3. Creating daily_goals table...")

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id serial PRIMARY KEY,
        date date UNIQUE NOT NULL,
        target_points integer DEFAULT 18,
        earned_points integer DEFAULT 0,
        task_count integer DEFAULT 0,
        current_streak integer DEFAULT 0,
        longest_streak integer DEFAULT 0,
        last_goal_hit_date date,
        updated_at timestamp with time zone DEFAULT now()
      )
    `
    console.log("   ✓ Created daily_goals table")
  } catch (e) {
    console.log("   - daily_goals table already exists")
  }

  // 4. Create indexes on tasks
  console.log("\n4. Creating indexes...")

  const indexes = [
    { name: "tasks_status_idx", sql: sql`CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status)` },
    { name: "tasks_client_id_idx", sql: sql`CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON tasks (client_id)` },
    { name: "tasks_completed_at_idx", sql: sql`CREATE INDEX IF NOT EXISTS tasks_completed_at_idx ON tasks (completed_at)` },
    { name: "tasks_sort_order_idx", sql: sql`CREATE INDEX IF NOT EXISTS tasks_sort_order_idx ON tasks (sort_order)` },
    { name: "tasks_status_sort_idx", sql: sql`CREATE INDEX IF NOT EXISTS tasks_status_sort_idx ON tasks (status, sort_order)` },
  ]

  for (const idx of indexes) {
    try {
      await idx.sql
      console.log(`   ✓ Created ${idx.name}`)
    } catch (e) {
      console.log(`   - ${idx.name} already exists`)
    }
  }

  // 5. Update foreign key constraints
  console.log("\n5. Updating foreign key constraints...")

  try {
    await sql`
      DO $$ BEGIN
        ALTER TABLE task_events
        DROP CONSTRAINT IF EXISTS move_events_move_id_moves_id_fk;
      EXCEPTION WHEN undefined_object THEN null;
      END $$
    `
    await sql`
      DO $$ BEGIN
        ALTER TABLE task_events
        ADD CONSTRAINT task_events_task_id_tasks_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE no action ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `
    console.log("   ✓ Updated task_events foreign key")
  } catch (e) {
    console.log("   - Foreign key update skipped:", e.message)
  }

  // 6. Add avoidance_incidents to daily_snapshots if missing
  console.log("\n6. Updating daily_snapshots...")

  try {
    await sql`ALTER TABLE daily_snapshots ADD COLUMN IF NOT EXISTS avoidance_incidents integer DEFAULT 0`
    console.log("   ✓ Added avoidance_incidents column")
  } catch (e) {
    console.log("   - avoidance_incidents already exists")
  }

  // 7. Verify final state
  console.log("\n7. Verifying migration...")

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `

  console.log("\n   Final tables:")
  tables.forEach(t => console.log(`   - ${t.table_name}`))

  const taskColumns = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'tasks'
    ORDER BY ordinal_position
  `

  console.log("\n   Tasks columns:")
  taskColumns.forEach(c => console.log(`   - ${c.column_name}`))

  console.log("\n=== Migration Complete ===")
}

main().catch(err => {
  console.error("\n❌ Migration failed:", err.message)
  process.exit(1)
})
