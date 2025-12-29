import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { dailyGoals, tasks } from "@/lib/schema"
import { eq, and, gte, sql } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"
import {
  analyzePace,
  getUrgencyPriority,
  generateUrgencyMessage,
  shouldSendUrgencyNotification,
  calculatePressureLevel,
  calculateWeeklyDebt,
} from "@/lib/urgency-system"
import { DAILY_TARGET_POINTS } from "@/lib/constants"

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken) return true
  if (!authHeader) return false

  const token = authHeader.replace("Bearer ", "")
  return token === expectedToken
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = await getDb()

    // Get current time in EST
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
    const todayStr = estNow.toISOString().split("T")[0]
    const currentHour = estNow.getHours()

    console.log("[Urgency Check] Running for", todayStr, "at hour", currentHour)

    // Get or create today's daily goal entry
    let todayGoal = await db.select().from(dailyGoals).where(eq(dailyGoals.date, todayStr)).limit(1)

    let dailyGoalEntry = todayGoal[0]

    if (!dailyGoalEntry) {
      // Create today's entry
      const [newEntry] = await db
        .insert(dailyGoals)
        .values({
          date: todayStr,
          targetPoints: DAILY_TARGET_POINTS,
          earnedPoints: 0,
          taskCount: 0,
          dailyDebt: 0,
          weeklyDebt: 0,
          pressureLevel: 0,
        })
        .returning()

      dailyGoalEntry = newEntry
    }

    // Calculate current earned points from completed tasks today
    const todayStart = new Date(todayStr + "T00:00:00-05:00")
    const completedToday = await db
      .select({
        points: sql<number>`COALESCE(${tasks.pointsFinal}, ${tasks.pointsAiGuess}, ${tasks.effortEstimate}, 2)`,
      })
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayStart)))

    const earnedPoints = completedToday.reduce((sum, t) => sum + (t.points || 0), 0)
    const taskCount = completedToday.length

    // Get week's data for weekly debt calculation
    const dayOfWeek = estNow.getDay() // 0=Sunday, 1=Monday, etc
    const weekStart = new Date(estNow)
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStart.setDate(weekStart.getDate() - daysSinceMonday)
    weekStart.setHours(0, 0, 0, 0)
    const weekStartStr = weekStart.toISOString().split("T")[0]

    const weekGoals = await db
      .select()
      .from(dailyGoals)
      .where(sql`${dailyGoals.date} >= ${weekStartStr} AND ${dailyGoals.date} <= ${todayStr}`)
      .orderBy(dailyGoals.date)

    // Calculate daily debt for today
    const dailyDebt = Math.max(0, DAILY_TARGET_POINTS - earnedPoints)

    // Calculate weekly debt
    const weeklyDebt = calculateWeeklyDebt(
      weekGoals.map((g) => ({
        earnedPoints: g.date === todayStr ? earnedPoints : g.earnedPoints,
        targetPoints: g.targetPoints,
      }))
    )

    // Analyze current pace
    const pace = analyzePace(earnedPoints, currentHour)
    const priority = getUrgencyPriority(pace)
    const pressureLevel = calculatePressureLevel(earnedPoints, dailyDebt, weeklyDebt, currentHour)

    console.log("[Urgency Check] Pace:", {
      earnedPoints,
      expectedPoints: pace.expectedPoints,
      delta: pace.delta,
      isCritical: pace.isCritical,
      isUrgent: pace.isUrgent,
      isWarning: pace.isWarning,
      weeklyDebt,
      pressureLevel,
    })

    // Update daily goal with current stats
    await db
      .update(dailyGoals)
      .set({
        earnedPoints,
        taskCount,
        dailyDebt,
        weeklyDebt,
        pressureLevel,
        updatedAt: new Date(),
      })
      .where(eq(dailyGoals.date, todayStr))

    // Determine if we should send a notification
    const shouldSend = shouldSendUrgencyNotification(
      currentHour,
      pace,
      dailyGoalEntry.lastUrgencyNotificationHour
    )

    if (!shouldSend) {
      return NextResponse.json({
        sent: false,
        reason: "No urgency notification needed at this time",
        pace: {
          earnedPoints,
          expectedPoints: pace.expectedPoints,
          delta: pace.delta,
          percentOfTarget: pace.percentOfDailyTarget,
        },
      })
    }

    // Generate and send urgency message
    const message = generateUrgencyMessage(pace, currentHour, dailyDebt, weeklyDebt)

    await sendNotification(message, {
      title: "Work OS - Urgency Alert",
      tags: "alarm_clock",
      priority,
    })

    // Update last notification hour
    await db
      .update(dailyGoals)
      .set({
        lastUrgencyNotificationHour: currentHour,
        updatedAt: new Date(),
      })
      .where(eq(dailyGoals.date, todayStr))

    console.log("[Urgency Check] Notification sent:", { priority, hour: currentHour })

    return NextResponse.json({
      sent: true,
      priority,
      hour: currentHour,
      pace: {
        earnedPoints,
        expectedPoints: pace.expectedPoints,
        delta: pace.delta,
        percentOfTarget: pace.percentOfDailyTarget,
      },
      debt: {
        daily: dailyDebt,
        weekly: weeklyDebt,
      },
      pressureLevel,
    })
  } catch (error) {
    console.error("[Urgency Check] Error:", error)
    return NextResponse.json({ error: "Failed to check urgency" }, { status: 500 })
  }
}

export const maxDuration = 60
