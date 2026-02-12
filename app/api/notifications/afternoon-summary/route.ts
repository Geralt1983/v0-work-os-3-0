export const maxDuration = 60

import { NextResponse } from "next/server"
import { sendNotification } from "@/lib/notifications"
import { getDb } from "@/lib/db"
import { tasks, clients, dailyGoals } from "@/lib/schema"
import { eq, gte, and, ne, inArray, sql } from "drizzle-orm"
import { DAILY_TARGET_POINTS, DAILY_MINIMUM_POINTS } from "@/lib/constants"
import { getTaskPoints } from "@/lib/domain"
import { analyzePace, getUrgencyPriority, calculateWeeklyDebt } from "@/lib/urgency-system"
import { getESTNow, getESTDateString, getESTTodayStart, estToUTC } from "@/lib/domain/timezone"

export async function GET() {
  console.log("[Afternoon Summary] Starting")

  try {
    const db = getDb()

    const now = new Date()
    const estTime = getESTNow(now)
    const todayStr = getESTDateString(now)
    const todayStart = estToUTC(getESTTodayStart(now))
    const currentHour = estTime.getUTCHours()

    console.log("[Afternoon Summary] Today start:", todayStart.toISOString())

    const todayTasksTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), 10000),
    )

    const todayTasks = await Promise.race([
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayStart)))
        .limit(maxDuration),
      todayTasksTimeoutPromise,
    ])

    const todayPoints = todayTasks.reduce((sum, t) => sum + getTaskPoints(t), 0)

    // Get unique clients touched - batch query instead of N+1
    const clientIds = [...new Set(todayTasks.map((t) => t.clientId).filter((id): id is number => id !== null))]
    const clientsTouched: string[] = clientIds.length > 0
      ? (await db.select({ name: clients.name }).from(clients).where(inArray(clients.id, clientIds))).map((c) => c.name)
      : []

    const activeTasksTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), 10000),
    )

    const activeTasks = await Promise.race([
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.status, "active"), ne(tasks.status, "done")))
        .limit(maxDuration),
      activeTasksTimeoutPromise,
    ])

    // Get weekly debt for context
    const dayOfWeek = estTime.getUTCDay()
    const weekStart = new Date(estTime)
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday)
    weekStart.setUTCHours(0, 0, 0, 0)
    const weekStartStr = weekStart.toISOString().split("T")[0]

    const weekGoals = await db
      .select()
      .from(dailyGoals)
      .where(sql`${dailyGoals.date} >= ${weekStartStr} AND ${dailyGoals.date} <= ${todayStr}`)

    const weeklyDebt = calculateWeeklyDebt(
      weekGoals.map((g) => ({
        earnedPoints: g.date === todayStr ? todayPoints : (g.earnedPoints || 0),
        targetPoints: g.targetPoints || 0,
      }))
    )

    // Analyze pace
    const pace = analyzePace(todayPoints, currentHour)
    const priority = getUrgencyPriority(pace)
    const percentOfTarget = Math.round((todayPoints / DAILY_TARGET_POINTS) * 100)
    const minimumMet = todayPoints >= DAILY_MINIMUM_POINTS
    const targetMet = todayPoints >= DAILY_TARGET_POINTS

    // Enhanced afternoon message with debt context
    let message = "🌤️ Afternoon Check-in\n\n"
    message += `📊 Today: ${todayPoints}/${DAILY_TARGET_POINTS} pts (${percentOfTarget}%)\n`
    message += `✓ ${todayTasks.length} tasks completed:\n`

    todayTasks.forEach(t => {
      message += `   • ${t.title} (${getTaskPoints(t)} pts)\n`
    })

    message += `\n📋 ${activeTasks.length} active remaining\n\n`

    if (targetMet) {
      message += "🎯 TARGET HIT! You've crushed today.\n"
    } else if (minimumMet) {
      const remaining = DAILY_TARGET_POINTS - todayPoints
      message += `✅ Minimum met! ${remaining.toFixed(1)} pts more for target.\n`
    } else {
      const toMinimum = DAILY_MINIMUM_POINTS - todayPoints
      const toTarget = DAILY_TARGET_POINTS - todayPoints
      message += `⏳ ${toMinimum.toFixed(1)} pts to minimum, ${toTarget.toFixed(1)} pts to target\n`
    }

    // Pace analysis
    if (pace.isCritical) {
      message += `\n🔴 CRITICAL: ${Math.abs(pace.delta).toFixed(1)} pts behind pace!\n`
    } else if (pace.isUrgent) {
      message += `\n⚠️ Behind pace by ${Math.abs(pace.delta).toFixed(1)} pts\n`
    } else if (pace.isAhead) {
      message += `\n🚀 Ahead of pace by ${pace.delta.toFixed(1)} pts!\n`
    }

    // Weekly debt context
    if (weeklyDebt > 0) {
      message += `\n💳 Weekly Debt: ${weeklyDebt} pts\n`
      if (weeklyDebt > 20) {
        message += "   🚨 CRITICAL weekly deficit!\n"
      } else if (weeklyDebt > 10) {
        message += "   ⚠️ Significant deficit building\n"
      }
    }

    if (clientsTouched.length > 0) {
      message += `\n✅ Touched: ${clientsTouched.join(", ")}`
    }

    console.log("[Afternoon Summary] Message:", message)

    const result = await sendNotification(message, {
      title: "Afternoon Check-in",
      tags: "clock4,chart_with_upwards_trend",
      priority,
    })

    return NextResponse.json({ ...result, message })
  } catch (error) {
    console.error("[Afternoon Summary] Error:", error)
    return NextResponse.json({ error: "Failed to send afternoon summary", details: String(error) }, { status: 500 })
  }
}
