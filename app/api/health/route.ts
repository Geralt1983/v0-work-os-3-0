import { NextResponse } from "next/server"
import { getDb, isPreviewWithoutDb } from "@/lib/db"
import { clients } from "@/lib/schema"
import { sql } from "drizzle-orm"

export async function GET() {
  try {
    // Return mock health in preview mode without database
    if (isPreviewWithoutDb()) {
      console.log("[v0] Health check: Preview mode (no database)")
      return NextResponse.json({
        status: "ok",
        database: "preview_mode",
        clientsCount: 5,
        timestamp: new Date().toISOString(),
        note: "Running in preview mode with mock data",
      })
    }
    
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
