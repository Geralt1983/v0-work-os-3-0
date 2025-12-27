import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("[v0] DATABASE_URL is not set")
    throw new Error("DATABASE_URL environment variable is not set")
  }

  // Clean up common copy-paste mistakes
  let connectionString = url.trim()
  if (connectionString.startsWith("psql ")) {
    connectionString = connectionString.replace(/^psql\s+['"]?/, "").replace(/['"]?\s*$/, "")
  }

  try {
    // Use HTTP driver for serverless - no persistent connections
    const sql = neon(connectionString)
    return drizzle(sql, { schema })
  } catch (error) {
    console.error("[v0] Failed to initialize database:", error)
    throw error
  }
}
