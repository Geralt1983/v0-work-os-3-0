import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks } from "@/lib/schema"
import { eq, gte, and, lte } from "drizzle-orm"
import { getESTDayOfWeek, getESTWeekStart, estToUTC } from "@/lib/domain"
import { calculateTotalPoints } from "@/lib/domain/task-types"
import { WEEKLY_MINIMUM_POINTS, WEEKLY_TARGET_POINTS } from "@/lib/constants"

export async function GET() {
  try {
    const db = getDb()
    const now = new Date()

    // Get day of week in EST (0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday)
    const dayOfWeek = getESTDayOfWeek(now)

    // Check if it's a workday (Mon-Fri)
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5

    // Calculate work week boundaries (Mon-Fri)
    const weekStartEST = getESTWeekStart(now)
    const weekEndEST = new Date(weekStartEST)
    weekEndEST.setDate(weekStartEST.getDate() + 4) // Friday
    weekEndEST.setHours(23, 59, 59, 999)

    // Convert to UTC for database queries
    const weekStartUTC = estToUTC(weekStartEST, now)
    const weekEndUTC = estToUTC(weekEndEST, now)

    // Workdays passed (Mon = 1, Tue = 2, Wed = 3, Thu = 4, Fri = 5)
    // On weekends, all 5 workdays have passed
    const workdaysPassed = isWorkday ? dayOfWeek : 5

    // Workdays remaining (NOT including today)
    const workdaysRemaining = isWorkday ? 5 - dayOfWeek : 0

    // Get completed tasks this work week (Mon-Fri only)
    const completedThisWeek = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, weekStartUTC), lte(tasks.completedAt, weekEndUTC)))

    // Calculate total points earned (uses pointsFinal > pointsAiGuess > effortEstimate fallback)
    const totalPoints = calculateTotalPoints(completedThisWeek)
    const tasksCompleted = completedThisWeek.length

    // Calculate daily average based on workdays passed
    const dailyAveragePoints = workdaysPassed > 0 ? Math.round(totalPoints / workdaysPassed) : 0

    // Project to end of work week (5 total workdays)
    const projectedPoints = workdaysPassed > 0 ? Math.round((totalPoints / workdaysPassed) * 5) : totalPoints

    // Calculate pace needed to hit goals (based on remaining workdays)
    const pointsNeededForMinimum = Math.max(0, WEEKLY_MINIMUM_POINTS - totalPoints)
    const pointsNeededForTarget = Math.max(0, WEEKLY_TARGET_POINTS - totalPoints)
    const pacePointsNeeded =
      workdaysRemaining > 0 ? Math.round(pointsNeededForMinimum / workdaysRemaining) : pointsNeededForMinimum
    const pacePointsForTarget =
      workdaysRemaining > 0 ? Math.round(pointsNeededForTarget / workdaysRemaining) : pointsNeededForTarget

    // Determine status
    let status: "behind" | "on_track" | "minimum_met" | "ideal_hit" | "week_complete"

    if (!isWorkday) {
      // It's Saturday or Sunday - week is complete
      if (totalPoints >= WEEKLY_TARGET_POINTS) {
        status = "ideal_hit"
      } else if (totalPoints >= WEEKLY_MINIMUM_POINTS) {
        status = "minimum_met"
      } else {
        status = "week_complete" // Week ended but goals not met
      }
    } else if (totalPoints >= WEEKLY_TARGET_POINTS) {
      status = "ideal_hit"
    } else if (totalPoints >= WEEKLY_MINIMUM_POINTS) {
      status = "minimum_met"
    } else if (workdaysRemaining === 0) {
      // It's Friday - if at 90%+ of minimum, consider it on track
      if (totalPoints >= WEEKLY_MINIMUM_POINTS * 0.9) {
        status = "on_track"
      } else {
        status = "behind"
      }
    } else if (projectedPoints >= WEEKLY_MINIMUM_POINTS) {
      status = "on_track"
    } else {
      status = "behind"
    }

    // Calculate percentages
    const minimumPercent = Math.min(100, Math.round((totalPoints / WEEKLY_MINIMUM_POINTS) * 100))
    const idealPercent = Math.min(100, Math.round((totalPoints / WEEKLY_TARGET_POINTS) * 100))

    return NextResponse.json({
      totalPoints,
      tasksCompleted,
      workdaysPassed,
      workdaysRemaining,
      daysRemaining: workdaysRemaining, // Keep for backwards compat
      dailyAveragePoints,
      projectedPoints,
      minimumGoal: WEEKLY_MINIMUM_POINTS,
      idealGoal: WEEKLY_TARGET_POINTS,
      minimumPercent,
      idealPercent,
      pacePointsNeeded,
      pacePointsForTarget,
      status,
      isWorkday,
    })
  } catch (error) {
    console.error("Failed to fetch weekly metrics:", error)
    // Return mock data on error
    return NextResponse.json({
      totalPoints: 27,
      tasksCompleted: 9,
      workdaysPassed: 3,
      workdaysRemaining: 2,
      daysRemaining: 2,
      dailyAveragePoints: 9,
      projectedPoints: 45,
      minimumGoal: WEEKLY_MINIMUM_POINTS,
      idealGoal: WEEKLY_TARGET_POINTS,
      minimumPercent: 45,
      idealPercent: 30,
      pacePointsNeeded: 17,
      pacePointsForTarget: 32,
      status: "on_track",
      isWorkday: true,
    })
  }
}
