import { sql } from "@vercel/postgres"
import { drizzle } from "drizzle-orm/vercel-postgres"
import * as schema from "./schema"

// Singleton pattern for connection reuse
let db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (db) return db

  // @vercel/postgres uses POSTGRES_URL env var automatically
  // It also supports DATABASE_URL as fallback
  db = drizzle(sql, { schema })
  return db
}
