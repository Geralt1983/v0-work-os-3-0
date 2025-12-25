import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { dailyGoals } from "@/lib/schema"
import { gte, desc } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()

    // Get today's date in EST
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
    const todayDate = estNow.toISOString().split("T")[0]

    // Calculate the start of the week (Monday)
    const dayOfWeek = estNow.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(estNow)
    weekStart.setDate(weekStart.getDate() - daysFromMonday)
    const weekStartStr = weekStart.toISOString().split("T")[0]

    // Get all daily goals from this week
    const weekGoals = await db
      .select()
      .from(dailyGoals)
      .where(gte(dailyGoals.date, weekStartStr))
      .orderBy(desc(dailyGoals.date))

    // Calculate totals
    const totalPoints = weekGoals.reduce((sum, g) => sum + (g.earnedPoints || 0), 0)
    const totalTasks = weekGoals.reduce((sum, g) => sum + (g.taskCount || 0), 0)

    // Find best day
    let bestDay: { date: string; points: number; tasks: number } | null = null
    for (const goal of weekGoals) {
      const points = goal.earnedPoints || 0
      if (!bestDay || points > bestDay.points) {
        bestDay = {
          date: goal.date,
          points,
          tasks: goal.taskCount || 0,
        }
      }
    }

    // Count days that hit the goal
    const daysHitGoal = weekGoals.filter((g) => {
      const earned = g.earnedPoints || 0
      const target = g.targetPoints || 18
      return earned >= target
    }).length

    // Get current streak from most recent entry
    const latestGoal = weekGoals[0]
    const currentStreak = latestGoal?.currentStreak || 0
    const longestStreak = latestGoal?.longestStreak || 0

    // Format best day for display
    let bestDayFormatted = null
    if (bestDay) {
      const date = new Date(bestDay.date + "T12:00:00")
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" })
      bestDayFormatted = {
        ...bestDay,
        dayName,
      }
    }

    return NextResponse.json({
      totalPoints,
      totalTasks,
      bestDay: bestDayFormatted,
      currentStreak,
      longestStreak,
      daysHitGoal,
      weekStart: weekStartStr,
      daysTracked: weekGoals.length,
    })
  } catch (error) {
    console.error("[weekly-summary] Failed to get summary:", error)
    return NextResponse.json(
      { error: "Failed to get weekly summary" },
      { status: 500 }
    )
  }
}
