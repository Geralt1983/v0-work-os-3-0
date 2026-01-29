import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// Get connection string from environment
function getConnectionString(): string {
  // Log available env vars for debugging
  const availableDbVars = Object.keys(process.env).filter(
    (k) => k.includes("NEON") || k.includes("POSTGRES") || k.includes("DATABASE")
  )
  console.log("[v0] DB: Available database env vars:", availableDbVars)

  const connectionString =
    process.env.NEON_DATABASE_URL ||
    process.env.NEON_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL

  if (!connectionString) {
    console.error("[v0] DB: No connection string found!")
    throw new Error("No database connection string found")
  }

  console.log("[v0] DB: Using connection string (first 50 chars):", connectionString.substring(0, 50) + "...")
  return connectionString
}

// Create drizzle instance
export function getDb() {
  try {
    const connectionString = getConnectionString()
    const sql = neon(connectionString)
    return drizzle(sql, { schema })
  } catch (error) {
    console.error("[v0] DB: Error creating database instance:", error)
    throw error
  }
}
