import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, and, gte, ne } from "drizzle-orm"
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

    // Get all external clients (type != 'internal')
    const externalClients = await db.select({ id: clients.id }).from(clients).where(ne(clients.type, "internal"))

    const externalClientIds = new Set(externalClients.map((c) => c.id))
    const totalExternalClients = externalClientIds.size

    // Count unique external clients touched today
    const clientsTouchedToday = new Set(
      completedToday.filter((m) => m.clientId && externalClientIds.has(m.clientId)).map((m) => m.clientId),
    ).size

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
    } else if (earnedMinutes === 0) {
      paceStatus = "behind" // No progress yet
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
      minimumMinutes,
      targetMinutes,
      percentOfMinimum,
      percentOfTarget,
      percent: percentOfTarget, // Keep for backwards compat
      paceStatus,
      momentum,
      streak,
      clientsTouchedToday,
      totalExternalClients,
    })
  } catch (error) {
    console.error("Failed to fetch metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
