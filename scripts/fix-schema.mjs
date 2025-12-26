import { neon } from "@neondatabase/serverless"

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_ovuCAGM65tfP@ep-ancient-star-ahvi0ebo-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

const sql = neon(DATABASE_URL)

async function fixSchema() {
  console.log("Checking and fixing database schema...")

  try {
    // Check if move_graveyard exists and rename to task_graveyard
    const moveGraveyardExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'move_graveyard'
      ) as exists
    `

    const taskGraveyardExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'task_graveyard'
      ) as exists
    `

    if (moveGraveyardExists[0].exists && !taskGraveyardExists[0].exists) {
      console.log("Renaming move_graveyard to task_graveyard...")
      await sql`ALTER TABLE move_graveyard RENAME TO task_graveyard`
      console.log("✓ Renamed move_graveyard to task_graveyard")
    } else if (!taskGraveyardExists[0].exists) {
      console.log("Creating task_graveyard table...")
      await sql`
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
        )
      `
      console.log("✓ Created task_graveyard table")
    } else {
      console.log("✓ task_graveyard table already exists")
    }

    // Check if last_task_id column exists in client_memory
    const lastTaskIdExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'client_memory' AND column_name = 'last_task_id'
      ) as exists
    `

    if (!lastTaskIdExists[0].exists) {
      console.log("Adding last_task_id column to client_memory...")
      await sql`ALTER TABLE client_memory ADD COLUMN last_task_id TEXT`
      console.log("✓ Added last_task_id column to client_memory")
    } else {
      console.log("✓ last_task_id column already exists in client_memory")
    }

    // Check if daily_goals table exists
    const dailyGoalsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'daily_goals'
      ) as exists
    `

    if (!dailyGoalsExists[0].exists) {
      console.log("Creating daily_goals table...")
      await sql`
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
        )
      `
      console.log("✓ Created daily_goals table")
    } else {
      console.log("✓ daily_goals table already exists")
    }

    // Check if behavioral_patterns table exists
    const behavioralPatternsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'behavioral_patterns'
      ) as exists
    `

    if (!behavioralPatternsExists[0].exists) {
      console.log("Creating behavioral_patterns table...")
      await sql`
        CREATE TABLE behavioral_patterns (
          id SERIAL PRIMARY KEY,
          pattern_type VARCHAR(50) NOT NULL,
          pattern_key VARCHAR(100) NOT NULL,
          pattern_value JSONB NOT NULL,
          confidence DECIMAL(3,2) DEFAULT 0.5,
          sample_size INTEGER DEFAULT 0,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
      console.log("✓ Created behavioral_patterns table")
    } else {
      console.log("✓ behavioral_patterns table already exists")
    }

    // Check if task_events table exists
    const taskEventsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'task_events'
      ) as exists
    `

    if (!taskEventsExists[0].exists) {
      console.log("Creating task_events table...")
      await sql`
        CREATE TABLE task_events (
          id SERIAL PRIMARY KEY,
          task_id INTEGER NOT NULL REFERENCES tasks(id),
          event_type VARCHAR(50) NOT NULL,
          from_status VARCHAR(50),
          to_status VARCHAR(50),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
      console.log("✓ Created task_events table")
    } else {
      console.log("✓ task_events table already exists")
    }

    console.log("\n✅ Schema fix complete!")
  } catch (error) {
    console.error("Error fixing schema:", error)
    process.exit(1)
  }
}

fixSchema()
