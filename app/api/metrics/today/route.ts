import { NextResponse } from "next/server"
import { getDb, isPreviewWithoutDb } from "@/lib/db"
import { tasks, clients, dailyGoals } from "@/lib/schema"
import { eq, and, gte, ne, desc } from "drizzle-orm"
import { calculateMomentum } from "@/lib/metrics"
import { DAILY_MINIMUM_POINTS, DAILY_TARGET_POINTS, WORK_START_HOUR, WORK_END_HOUR } from "@/lib/constants"
import { getESTNow, getESTTodayStart, estToUTC } from "@/lib/domain"
import { calculateTotalPoints } from "@/lib/domain/task-types"

export async function GET() {
  try {
    // Return mock data in preview mode without database
    if (isPreviewWithoutDb()) {
      console.log("[v0] Metrics/today API: Using mock data (preview mode)")
      return NextResponse.json({
        completedCount: 2,
        earnedPoints: 6,
        targetPoints: DAILY_TARGET_POINTS,
        percentOfMinimum: 50,
        percentOfTarget: 37,
        percent: 37,
        paceStatus: "behind",
        momentum: {
          score: 50,
          percent: 37,
          status: "on_track",
          label: "On track",
          expectedByNow: 8,
          actualPoints: 6,
          dayProgress: 50,
        },
        streak: 3,
        clientsTouchedToday: 2,
        totalExternalClients: 4,
      })
    }
    
    const db = getDb()

    const now = new Date()
    const estNow = getESTNow(now)
    const todayUTC = estToUTC(getESTTodayStart(now), now)

    const completedToday = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayUTC)))

    // Calculate earned points (uses pointsFinal > pointsAiGuess > effortEstimate fallback)
    const earnedPoints = calculateTotalPoints(completedToday)

    // Get all external clients (type != 'internal')
    const externalClients = await db.select({ id: clients.id }).from(clients).where(ne(clients.type, "internal"))

    const externalClientIds = new Set(externalClients.map((c) => c.id))
    const totalExternalClients = externalClientIds.size

    // Count unique external clients touched today
    const clientsTouchedToday = new Set(
      completedToday.filter((m) => m.clientId && externalClientIds.has(m.clientId)).map((m) => m.clientId),
    ).size

    const minimumPoints = DAILY_MINIMUM_POINTS // 12 points
    const targetPoints = DAILY_TARGET_POINTS // 18 points

    const percentOfMinimum = Math.round((earnedPoints / minimumPoints) * 100)
    const percentOfTarget = Math.round((earnedPoints / targetPoints) * 100)

    const momentum = calculateMomentum(earnedPoints)

    let paceStatus: "ahead" | "on_track" | "behind" | "minimum_only"
    if (percentOfTarget >= 100) {
      paceStatus = "ahead" // Hit target
    } else if (percentOfMinimum >= 100) {
      paceStatus = "minimum_only" // Hit minimum but not target
    } else if (earnedPoints === 0) {
      paceStatus = "behind" // No progress yet
    } else {
      // Calculate day progress
      const estHour = estNow.getHours() + estNow.getMinutes() / 60
      const dayProgress = Math.max(0, Math.min(100, ((estHour - WORK_START_HOUR) / (WORK_END_HOUR - WORK_START_HOUR)) * 100))

      paceStatus = percentOfTarget >= dayProgress ? "on_track" : "behind"
    }

    // Get current streak from dailyGoals table
    const [latestGoal] = await db
      .select({ currentStreak: dailyGoals.currentStreak })
      .from(dailyGoals)
      .orderBy(desc(dailyGoals.date))
      .limit(1)
    const streak = latestGoal?.currentStreak ?? 0

    return NextResponse.json({
      completedCount: completedToday.length,
      earnedPoints,
      targetPoints,
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
