import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, today)))

    const earnedMinutes = completedToday.reduce((sum, m) => {
      const effort = m.effortEstimate || 2
      return sum + effort * 20
    }, 0)

    return NextResponse.json({
      completedCount: completedToday.length,
      earnedMinutes,
      targetMinutes: 180,
      paceStatus: earnedMinutes >= 180 ? "on_track" : "behind",
    })
  } catch (error) {
    console.error("Failed to fetch metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
