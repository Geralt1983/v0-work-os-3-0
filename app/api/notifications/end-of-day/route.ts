import { NextResponse } from "next/server"
import { tasks, clients, dailyGoals } from "@/lib/schema"
import { eq, and, gte, sql } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"
import { getDb } from "@/lib/db"
import { getTaskPoints } from "@/lib/domain"
import { DAILY_TARGET_POINTS, DAILY_MINIMUM_POINTS } from "@/lib/constants"
import { generateEndOfDaySummary, calculateWeeklyDebt } from "@/lib/urgency-system"

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken) return true
  if (!authHeader) return false

  const token = authHeader.replace("Bearer ", "")
  return token === expectedToken
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get today's stats
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
    const todayStr = estNow.toISOString().split("T")[0]
    const todayStart = new Date(todayStr + "T00:00:00-05:00")
    const dayOfWeek = DAYS_OF_WEEK[estNow.getDay()]

    const dbInstance = await getDb()
    const completedToday = await dbInstance
      .select()
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayStart)))

    const taskCount = completedToday.length
    const earnedPoints = completedToday.reduce((sum, t) => sum + getTaskPoints(t.tasks), 0)

    // Calculate daily debt
    const dailyDebt = Math.max(0, DAILY_TARGET_POINTS - earnedPoints)

    // Get week's data for weekly debt
    const dayNum = estNow.getDay()
    const weekStart = new Date(estNow)
    const daysSinceMonday = dayNum === 0 ? 6 : dayNum - 1
    weekStart.setDate(weekStart.getDate() - daysSinceMonday)
    weekStart.setHours(0, 0, 0, 0)
    const weekStartStr = weekStart.toISOString().split("T")[0]

    const weekGoals = await dbInstance
      .select()
      .from(dailyGoals)
      .where(sql`${dailyGoals.date} >= ${weekStartStr} AND ${dailyGoals.date} <= ${todayStr}`)

    // Calculate weekly debt
    const weeklyDebt = calculateWeeklyDebt(
      weekGoals.map((g) => ({
        earnedPoints: g.date === todayStr ? earnedPoints : g.earnedPoints,
        targetPoints: g.targetPoints,
      }))
    )

    // Update or create today's daily goal entry
    const existingGoal = await dbInstance.select().from(dailyGoals).where(eq(dailyGoals.date, todayStr)).limit(1)

    if (existingGoal.length > 0) {
      await dbInstance
        .update(dailyGoals)
        .set({
          earnedPoints,
          taskCount,
          dailyDebt,
          weeklyDebt,
          updatedAt: new Date(),
        })
        .where(eq(dailyGoals.date, todayStr))
    } else {
      await dbInstance.insert(dailyGoals).values({
        date: todayStr,
        earnedPoints,
        taskCount,
        targetPoints: DAILY_TARGET_POINTS,
        dailyDebt,
        weeklyDebt,
      })
    }

    // Generate enhanced end-of-day summary with consequences
    const message = generateEndOfDaySummary(
      earnedPoints,
      DAILY_TARGET_POINTS,
      taskCount,
      dailyDebt,
      weeklyDebt,
      dayOfWeek
    )

    // Determine priority based on performance
    let priority: "min" | "low" | "default" | "high" | "urgent" = "default"
    const percentOfTarget = Math.round((earnedPoints / DAILY_TARGET_POINTS) * 100)

    if (percentOfTarget >= 100) {
      priority = "high" // Celebrate success
    } else if (percentOfTarget < 67) {
      priority = "high" // Failed minimum, needs attention
    }

    await sendNotification(message, {
      title: "End of Day",
      tags: "checkered_flag",
      priority,
    })

    return NextResponse.json({
      sent: true,
      stats: {
        taskCount,
        earnedPoints,
        targetPoints: DAILY_TARGET_POINTS,
        percentOfTarget,
        dailyDebt,
        weeklyDebt,
      },
    })
  } catch (error) {
    console.error("End of day notification failed:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export const maxDuration = 60
