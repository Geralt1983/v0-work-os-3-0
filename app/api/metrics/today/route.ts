import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { calculateMomentum } from "@/lib/metrics"

export async function GET() {
  try {
    const db = getDb()

    const now = new Date()
    // Convert to EST (UTC-5) or EDT (UTC-4)
    const estOffset = -5 * 60 // EST offset in minutes
    const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60 * 1000)

    // Get start of today in EST
    const todayEST = new Date(estNow)
    todayEST.setHours(0, 0, 0, 0)

    // Convert back to UTC for database query
    const todayUTC = new Date(todayEST.getTime() - (now.getTimezoneOffset() + estOffset) * 60 * 1000)

    console.log("[v0] Metrics API: Querying for moves completed since", todayUTC.toISOString())

    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, todayUTC)))

    console.log("[v0] Metrics API: Found", completedToday.length, "completed moves today")
    console.log(
      "[v0] Metrics API: Completed moves:",
      completedToday.map((m) => ({
        id: m.id,
        title: m.title,
        completedAt: m.completedAt,
        effortEstimate: m.effortEstimate,
      })),
    )

    const earnedMinutes = completedToday.reduce((sum, m) => {
      const effort = m.effortEstimate || 2
      return sum + effort * 20
    }, 0)

    const targetMinutes = 180
    const percent = Math.round((earnedMinutes / targetMinutes) * 100)

    const momentum = calculateMomentum(completedToday)

    // Calculate streak (consecutive days hitting target)
    const streak = 0 // TODO: Implement from daily_log table

    return NextResponse.json({
      completedCount: completedToday.length,
      earnedMinutes,
      targetMinutes,
      percent,
      paceStatus: percent >= 100 ? "on_track" : "behind",
      momentum,
      streak,
    })
  } catch (error) {
    console.error("Failed to fetch metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
