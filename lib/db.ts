import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
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

  // Create neon client with connection string
  const sql = neon(connectionString)
  db = drizzle({ client: sql, schema })
  return db
}
