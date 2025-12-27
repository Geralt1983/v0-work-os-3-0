import { Pool } from "@neondatabase/serverless"
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless"
import * as schema from "./schema"

let cachedDb: NeonDatabase<typeof schema> | null = null

export function getDb() {
  if (cachedDb) return cachedDb

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
    // This is compatible with newer @neondatabase/serverless versions
    const pool = new Pool({ connectionString })
    cachedDb = drizzle(pool, { schema })
    return cachedDb
  } catch (error) {
    console.error("[v0] Failed to initialize database:", error)
    throw error
  }
}
