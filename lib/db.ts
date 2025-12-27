import { sql } from "@vercel/postgres"
import { drizzle } from "drizzle-orm/vercel-postgres"
import * as schema from "./schema"

export function getDb() {
  // @vercel/postgres uses POSTGRES_URL env var, but we support both
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    console.error("[v0] DATABASE_URL or POSTGRES_URL is not set")
    throw new Error("DATABASE_URL or POSTGRES_URL environment variable is not set")
  }

  try {
    // Use Vercel Postgres HTTP driver for serverless/edge compatibility
    return drizzle(sql, { schema })
  } catch (error) {
    console.error("[v0] Failed to initialize database:", error)
    throw error
  }
}
