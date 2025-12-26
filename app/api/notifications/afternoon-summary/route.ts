export const maxDuration = 60

import { NextResponse } from "next/server"
import { sendNotification, formatAfternoonSummary } from "@/lib/notifications"
import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, gte, and, ne, inArray } from "drizzle-orm"
import { DAILY_TARGET_MINUTES } from "@/lib/constants"

export async function GET() {
  console.log("[Afternoon Summary] Starting")

  try {
    const db = getDb()

    const now = new Date()
    const estOffset = -5 * 60
    const utcOffset = now.getTimezoneOffset()
    const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)

    const todayStr = estTime.toISOString().split("T")[0]
    const todayStart = new Date(`${todayStr}T00:00:00-05:00`)

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

    const todayMinutes = todayTasks.reduce((sum, t) => sum + (t.effortEstimate || 2) * 20, 0)

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

    const message = formatAfternoonSummary({
      todayTasks: todayTasks.length,
      todayMinutes,
      targetMinutes: DAILY_TARGET_MINUTES,
      clientsTouched,
      remainingActive: activeTasks.length,
    })

    console.log("[Afternoon Summary] Message:", message)

    const result = await sendNotification(message, {
      title: "Afternoon Check-in",
      tags: "clock4,chart_with_upwards_trend",
      priority: "default",
    })

    return NextResponse.json({ ...result, message })
  } catch (error) {
    console.error("[Afternoon Summary] Error:", error)
    return NextResponse.json({ error: "Failed to send afternoon summary", details: String(error) }, { status: 500 })
  }
}
