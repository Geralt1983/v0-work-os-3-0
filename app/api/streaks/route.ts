import { NextResponse } from "next/server"
import { getDb, isPreviewWithoutDb } from "@/lib/db"
import { dailyGoals } from "@/lib/schema"
import { eq, desc } from "drizzle-orm"

export async function GET() {
  try {
    // Return mock data in preview mode without database
    if (isPreviewWithoutDb()) {
      console.log("[v0] Streaks API: Using mock data (preview mode)")
      return NextResponse.json({
        currentStreak: 3,
        longestStreak: 7,
        hitGoalToday: false,
        earnedPoints: 6,
        targetPoints: 16,
        taskCount: 2,
      })
    }
    
    const db = getDb()

    // Get today's date in EST
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
    const todayDate = estNow.toISOString().split("T")[0]

    // Get today's goal entry
    const [todayGoal] = await db
      .select()
      .from(dailyGoals)
      .where(eq(dailyGoals.date, todayDate))
      .limit(1)

    // Get the most recent goal entry to find current/longest streak
    const [latestGoal] = await db
      .select()
      .from(dailyGoals)
      .orderBy(desc(dailyGoals.date))
      .limit(1)

    const earnedPoints = todayGoal?.earnedPoints || 0
    const targetPoints = todayGoal?.targetPoints || 18
    const hitGoalToday = earnedPoints >= targetPoints

    // Current streak logic:
    // If we hit the goal today, use today's current_streak
    // Otherwise, check if yesterday was the last goal hit date
    let currentStreak = 0
    if (hitGoalToday) {
      currentStreak = todayGoal?.currentStreak || 1
    } else if (latestGoal?.lastGoalHitDate) {
      const yesterday = new Date(estNow)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split("T")[0]

      if (latestGoal.lastGoalHitDate === yesterdayStr) {
        // Yesterday was the last goal hit, streak is still alive
        currentStreak = latestGoal.currentStreak || 0
      }
      // Otherwise streak has been broken
    }

    const longestStreak = latestGoal?.longestStreak || 0

    return NextResponse.json({
      currentStreak,
      longestStreak,
      hitGoalToday,
      earnedPoints,
      targetPoints,
      taskCount: todayGoal?.taskCount || 0,
    })
  } catch (error) {
    console.error("[streaks] Failed to get streaks:", error)
    return NextResponse.json(
      { error: "Failed to get streaks" },
      { status: 500 }
    )
  }
}
