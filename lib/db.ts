import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

let cachedDb: ReturnType<typeof drizzle> | null = null

/**
 * Check if we're in preview/development environment without a database
 */
export function isPreviewWithoutDb(): boolean {
  const hasDbUrl = !!process.env.DATABASE_URL
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development"
  return !hasDbUrl && isPreview
}

export function getDb() {
  if (cachedDb) return cachedDb

  const url = process.env.DATABASE_URL
  if (!url) {
    // In preview/dev mode without DB, return null to signal mock data should be used
    if (isPreviewWithoutDb()) {
      console.log("[v0] DATABASE_URL is not set - preview mode will use mock data")
      return null as unknown as ReturnType<typeof drizzle>
    }
    console.error("[v0] DATABASE_URL is not set")
    throw new Error("DATABASE_URL environment variable is not set")
  }

  console.log("[v0] Initializing database connection")

  // Clean up common copy-paste mistakes
  let connectionString = url.trim()
  if (connectionString.startsWith("psql ")) {
    connectionString = connectionString.replace(/^psql\s+['"]?/, "").replace(/['"]?\s*$/, "")
  }

  try {
    const sql = neon(connectionString)
    cachedDb = drizzle(sql, { schema })
    console.log("[v0] Database connection initialized successfully")
    return cachedDb
  } catch (error) {
    console.error("[v0] Failed to initialize database:", error)
    throw error
  }
}
