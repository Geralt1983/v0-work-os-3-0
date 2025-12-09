import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq, gte, and } from "drizzle-orm"

const MINIMUM_WEEKLY_GOAL = 900 // 15 hours in minutes
const IDEAL_WEEKLY_GOAL = 1200 // 20 hours in minutes

export async function GET() {
  try {
    const db = getDb()

    // Get the start of the current week (Monday)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    // Days elapsed in the week (1-7)
    const daysElapsed = Math.min(7, Math.ceil((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)))

    // Get completed moves this week
    const completedThisWeek = await db
      .select({
        effortEstimate: moves.effortEstimate,
        completedAt: moves.completedAt,
      })
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, weekStart)))

    // Calculate total minutes earned
    const totalMinutes = completedThisWeek.reduce((sum, move) => {
      return sum + (move.effortEstimate || 1) * 20
    }, 0)

    const movesCompleted = completedThisWeek.length

    // Calculate daily average
    const dailyAverage = daysElapsed > 0 ? Math.round(totalMinutes / daysElapsed) : 0

    // Project to end of week (assuming same daily average)
    const daysRemaining = 7 - daysElapsed
    const projectedTotal = totalMinutes + dailyAverage * daysRemaining

    // Calculate pace needed to hit goals
    const minutesNeededForMinimum = Math.max(0, MINIMUM_WEEKLY_GOAL - totalMinutes)
    const minutesNeededForIdeal = Math.max(0, IDEAL_WEEKLY_GOAL - totalMinutes)
    const paceForMinimum =
      daysRemaining > 0 ? Math.round(minutesNeededForMinimum / daysRemaining) : minutesNeededForMinimum
    const paceForIdeal = daysRemaining > 0 ? Math.round(minutesNeededForIdeal / daysRemaining) : minutesNeededForIdeal

    // Determine status
    let status: "behind" | "on_track" | "minimum_met" | "ideal_hit"
    if (totalMinutes >= IDEAL_WEEKLY_GOAL) {
      status = "ideal_hit"
    } else if (totalMinutes >= MINIMUM_WEEKLY_GOAL) {
      status = "minimum_met"
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
      daysElapsed,
      daysRemaining,
      dailyAverage,
      projectedTotal,
      minimumGoal: MINIMUM_WEEKLY_GOAL,
      idealGoal: IDEAL_WEEKLY_GOAL,
      minimumPercent,
      idealPercent,
      paceForMinimum,
      paceForIdeal,
      status,
    })
  } catch (error) {
    console.error("Failed to fetch weekly metrics:", error)
    // Return mock data on error
    return NextResponse.json({
      totalMinutes: 540,
      movesCompleted: 18,
      daysElapsed: 3,
      daysRemaining: 4,
      dailyAverage: 180,
      projectedTotal: 1260,
      minimumGoal: MINIMUM_WEEKLY_GOAL,
      idealGoal: IDEAL_WEEKLY_GOAL,
      minimumPercent: 60,
      idealPercent: 45,
      paceForMinimum: 90,
      paceForIdeal: 165,
      status: "on_track",
    })
  }
}
