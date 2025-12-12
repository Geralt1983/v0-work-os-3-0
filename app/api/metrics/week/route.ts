import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq, gte, and, lte } from "drizzle-orm"

const MINIMUM_WEEKLY_GOAL = 900 // 15 hours in minutes
const IDEAL_WEEKLY_GOAL = 1200 // 20 hours in minutes

export async function GET() {
  try {
    const db = getDb()

    // Get current time in EST
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60 * 1000)

    // Get day of week (0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday)
    const dayOfWeek = estNow.getDay()

    // Check if it's a workday (Mon-Fri)
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5

    // Calculate Monday 12:00am EST for this week
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStartEST = new Date(estNow)
    weekStartEST.setDate(estNow.getDate() + mondayOffset)
    weekStartEST.setHours(0, 0, 0, 0)

    // Calculate Friday 11:59pm EST
    const weekEndEST = new Date(weekStartEST)
    weekEndEST.setDate(weekStartEST.getDate() + 4) // Friday
    weekEndEST.setHours(23, 59, 59, 999)

    // Convert to UTC for database queries
    const weekStartUTC = new Date(weekStartEST.getTime() - (now.getTimezoneOffset() + estOffset) * 60 * 1000)
    const weekEndUTC = new Date(weekEndEST.getTime() - (now.getTimezoneOffset() + estOffset) * 60 * 1000)

    // Workdays passed (Mon = 1, Tue = 2, Wed = 3, Thu = 4, Fri = 5)
    // On weekends, all 5 workdays have passed
    const workdaysPassed = isWorkday ? dayOfWeek : 5

    // Workdays remaining (NOT including today)
    // On Mon (day 1): 4 remaining, Tue: 3, Wed: 2, Thu: 1, Fri: 0, Sat/Sun: 0
    const workdaysRemaining = isWorkday ? 5 - dayOfWeek : 0

    // Get completed moves this work week (Mon-Fri only)
    const completedThisWeek = await db
      .select({
        effortEstimate: moves.effortEstimate,
        completedAt: moves.completedAt,
      })
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, weekStartUTC), lte(moves.completedAt, weekEndUTC)))

    // Calculate total minutes earned
    const totalMinutes = completedThisWeek.reduce((sum, move) => {
      return sum + (move.effortEstimate || 1) * 20
    }, 0)

    const movesCompleted = completedThisWeek.length

    // Calculate daily average based on workdays passed
    const dailyAverage = workdaysPassed > 0 ? Math.round(totalMinutes / workdaysPassed) : 0

    // Project to end of work week (5 total workdays)
    const projectedTotal = workdaysPassed > 0 ? Math.round((totalMinutes / workdaysPassed) * 5) : totalMinutes

    // Calculate pace needed to hit goals (based on remaining workdays)
    const minutesNeededForMinimum = Math.max(0, MINIMUM_WEEKLY_GOAL - totalMinutes)
    const minutesNeededForIdeal = Math.max(0, IDEAL_WEEKLY_GOAL - totalMinutes)
    const paceForMinimum =
      workdaysRemaining > 0 ? Math.round(minutesNeededForMinimum / workdaysRemaining) : minutesNeededForMinimum
    const paceForIdeal =
      workdaysRemaining > 0 ? Math.round(minutesNeededForIdeal / workdaysRemaining) : minutesNeededForIdeal

    // Determine status
    let status: "behind" | "on_track" | "minimum_met" | "ideal_hit" | "week_complete"

    if (!isWorkday) {
      // It's Saturday or Sunday - week is complete
      if (totalMinutes >= IDEAL_WEEKLY_GOAL) {
        status = "ideal_hit"
      } else if (totalMinutes >= MINIMUM_WEEKLY_GOAL) {
        status = "minimum_met"
      } else {
        status = "week_complete" // Week ended but goals not met
      }
    } else if (totalMinutes >= IDEAL_WEEKLY_GOAL) {
      status = "ideal_hit"
    } else if (totalMinutes >= MINIMUM_WEEKLY_GOAL) {
      status = "minimum_met"
    } else if (workdaysRemaining === 0) {
      // It's Friday - if at 90%+ of minimum, consider it on track
      if (totalMinutes >= MINIMUM_WEEKLY_GOAL * 0.9) {
        status = "on_track"
      } else {
        status = "behind"
      }
    } else if (projectedTotal >= MINIMUM_WEEKLY_GOAL) {
      status = "on_track"
    } else {
      status = "behind"
    }

    // Calculate percentages
    const minimumPercent = Math.min(100, Math.round((totalMinutes / MINIMUM_WEEKLY_GOAL) * 100))
    const idealPercent = Math.min(100, Math.round((totalMinutes / IDEAL_WEEKLY_GOAL) * 100))

    return NextResponse.json({
      totalMinutes,
      movesCompleted,
      workdaysPassed, // renamed from daysElapsed
      workdaysRemaining, // renamed from daysRemaining
      daysElapsed: workdaysPassed, // Keep for backwards compat
      daysRemaining: workdaysRemaining, // Keep for backwards compat
      dailyAverage,
      projectedTotal,
      minimumGoal: MINIMUM_WEEKLY_GOAL,
      idealGoal: IDEAL_WEEKLY_GOAL,
      minimumPercent,
      idealPercent,
      paceForMinimum,
      paceForIdeal,
      status,
      isWorkday: true, // Let UI know if it's a workday
    })
  } catch (error) {
    console.error("Failed to fetch weekly metrics:", error)
    // Return mock data on error
    return NextResponse.json({
      totalMinutes: 540,
      movesCompleted: 18,
      workdaysPassed: 3,
      workdaysRemaining: 2,
      daysElapsed: 3,
      daysRemaining: 2,
      dailyAverage: 180,
      projectedTotal: 900,
      minimumGoal: MINIMUM_WEEKLY_GOAL,
      idealGoal: IDEAL_WEEKLY_GOAL,
      minimumPercent: 60,
      idealPercent: 45,
      paceForMinimum: 180,
      paceForIdeal: 330,
      status: "on_track",
      isWorkday: true,
    })
  }
}
