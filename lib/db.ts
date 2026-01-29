import { createPool } from "@vercel/postgres"
import { drizzle } from "drizzle-orm/vercel-postgres"
import * as schema from "./schema"

// Singleton pattern for connection reuse
let db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (db) return db

  // Use Neon connection string from environment
  const connectionString =
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL

  if (!connectionString) {
    throw new Error("No database connection string found")
  }

  // Create pool with explicit connection string
  const pool = createPool({ connectionString })
  db = drizzle(pool, { schema })
  return db
}
