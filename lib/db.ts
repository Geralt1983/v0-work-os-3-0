import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// Get connection string from environment
function getConnectionString(): string {
  const connectionString =
    process.env.NEON_DATABASE_URL ||
    process.env.NEON_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL

  if (!connectionString) {
    throw new Error("No database connection string found")
  }

  return connectionString
}

// Create drizzle instance
export function getDb() {
  const connectionString = getConnectionString()
  const sql = neon(connectionString)
  return drizzle(sql, { schema })
}
