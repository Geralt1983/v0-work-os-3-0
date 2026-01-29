import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// Get connection string from environment
function getConnectionString(): string {
  // Check all possible env var names for Neon connection string
  const connectionString =
    process.env.NEON_DATABASE_URL ||
    process.env.NEON_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL

  if (!connectionString) {
    console.error("[v0] DB: No connection string found. Available env vars:", Object.keys(process.env).filter(k => k.includes('NEON') || k.includes('POSTGRES') || k.includes('DATABASE')))
    throw new Error("No database connection string found. Please ensure NEON_DATABASE_URL or DATABASE_URL is set.")
  }

  console.log("[v0] DB: Using connection string from env")
  return connectionString
}

// Create drizzle instance - pass neon client directly as first argument
export function getDb() {
  const connectionString = getConnectionString()
  const sql = neon(connectionString)
  // Use the direct pattern: drizzle(sql) not drizzle({ client: sql })
  return drizzle(sql, { schema })
}
