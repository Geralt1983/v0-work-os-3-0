import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { calculateMomentum } from "@/lib/metrics"
import { DAILY_MINIMUM_MINUTES, DAILY_TARGET_MINUTES } from "@/lib/constants"

export async function GET() {
  try {
    const db = getDb()

    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60 * 1000)

    const todayEST = new Date(estNow)
    todayEST.setHours(0, 0, 0, 0)

    const todayUTC = new Date(todayEST.getTime() - (now.getTimezoneOffset() + estOffset) * 60 * 1000)

    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, todayUTC)))

    const earnedMinutes = completedToday.reduce((sum, m) => {
      const effort = m.effortEstimate || 2
      return sum + effort * 20
    }, 0)

    const minimumMinutes = DAILY_MINIMUM_MINUTES // 180
    const targetMinutes = DAILY_TARGET_MINUTES // 240

    const percentOfMinimum = Math.round((earnedMinutes / minimumMinutes) * 100)
    const percentOfTarget = Math.round((earnedMinutes / targetMinutes) * 100)

    const momentum = calculateMomentum(earnedMinutes)

    let paceStatus: "ahead" | "on_track" | "behind" | "minimum_only"
    if (percentOfTarget >= 100) {
      paceStatus = "ahead" // Hit target (4 hours)
    } else if (percentOfMinimum >= 100) {
      paceStatus = "minimum_only" // Hit minimum but not target
    } else {
      // Calculate day progress
      const estHour = estNow.getHours() + estNow.getMinutes() / 60
      const workStartHour = 9
      const workEndHour = 18
      const dayProgress = Math.max(0, Math.min(100, ((estHour - workStartHour) / (workEndHour - workStartHour)) * 100))

      paceStatus = percentOfTarget >= dayProgress ? "on_track" : "behind"
    }

    const streak = 0 // TODO: Implement from daily_log table

    return NextResponse.json({
      completedCount: completedToday.length,
      earnedMinutes,
      minimumMinutes, // NEW
      targetMinutes,
      percentOfMinimum, // NEW
      percentOfTarget, // NEW (replaces old 'percent')
      percent: percentOfTarget, // Keep for backwards compat
      paceStatus,
      momentum,
      streak,
    })
  } catch (error) {
    console.error("Failed to fetch metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
