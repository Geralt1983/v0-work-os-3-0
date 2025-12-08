import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { clients } from "@/lib/schema"
import { sql } from "drizzle-orm"

export async function GET() {
  try {
    console.log("[v0] Health check: Testing database connection")
    const db = getDb()

    // Test database connection with a simple query
    const result = await db.select({ count: sql<number>`count(*)` }).from(clients)

    console.log("[v0] Health check: Database connected, clients count:", result[0]?.count)

    return NextResponse.json({
      status: "ok",
      database: "connected",
      clientsCount: result[0]?.count ?? 0,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Health check error:", error)
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: String(error),
      },
      { status: 500 },
    )
  }
}
