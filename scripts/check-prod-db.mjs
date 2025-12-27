import { neon } from "@neondatabase/serverless"

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("Usage: node scripts/check-prod-db.mjs <DATABASE_URL>")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function main() {
  console.log("Checking production database tables...\n")

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `

  console.log("Existing tables:")
  tables.forEach(t => console.log(`  - ${t.table_name}`))
  console.log("")

  // Check if moves table exists (old schema)
  const hasMoves = tables.some(t => t.table_name === "moves")
  const hasTasks = tables.some(t => t.table_name === "tasks")

  if (hasMoves && !hasTasks) {
    console.log("⚠️  Found 'moves' table but no 'tasks' table")
    console.log("   Need to rename moves → tasks")
  } else if (hasTasks) {
    console.log("✓ 'tasks' table exists")
  }

  // Check for points columns
  if (hasTasks || hasMoves) {
    const tableName = hasTasks ? "tasks" : "moves"
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = ${tableName}
      ORDER BY ordinal_position
    `
    console.log(`\nColumns in ${tableName}:`)
    columns.forEach(c => console.log(`  - ${c.column_name}`))

    const hasPointsColumns = columns.some(c => c.column_name === "points_ai_guess")
    if (!hasPointsColumns) {
      console.log("\n⚠️  Missing points columns (points_ai_guess, points_final)")
    }
  }
}

main().catch(console.error)
