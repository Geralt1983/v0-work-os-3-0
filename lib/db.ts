import { neon, type NeonQueryFunction } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

let _db: NeonHttpDatabase<typeof schema> | null = null
let _sql: NeonQueryFunction<false, false> | null = null

function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set")
  }
  // Clean up common copy-paste mistakes (e.g., `psql 'url'` wrapper)
  let cleaned = url.trim()
  if (cleaned.startsWith("psql ")) {
    cleaned = cleaned.replace(/^psql\s+['"]?/, "").replace(/['"]?\s*$/, "")
  }
  return cleaned
}

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const connectionString = getConnectionString()
    _sql = neon(connectionString)
    _db = drizzle(_sql, { schema })
  }
  return _db
}

// For convenience, export a getter that can be used like `db`
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_, prop) {
    return getDb()[prop as keyof NeonHttpDatabase<typeof schema>]
  },
})
