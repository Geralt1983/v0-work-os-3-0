export const maxDuration = 60

import { NextResponse } from "next/server"
import { sendNotification, formatMorningSummary } from "@/lib/notifications"
import { getDb } from "@/lib/db"
import { tasks, clients, taskEvents } from "@/lib/schema"
import { eq, gte, and, desc, sql } from "drizzle-orm"

export async function GET() {
  console.log("[Morning Summary] Starting")

  try {
    const db = getDb()

    const now = new Date()
    const estOffset = -5 * 60
    const utcOffset = now.getTimezoneOffset()
    const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)

    const dayOfWeek = estTime.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(estTime)
    weekStart.setDate(estTime.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    // Convert back to UTC for DB query
    const weekStartUTC = new Date(weekStart.getTime() - (utcOffset + estOffset) * 60 * 1000)

    console.log("[Morning Summary] Week start:", weekStartUTC.toISOString())

    const taskTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), 10000),
    )

    // Get tasks completed this week
    const weekTasks = await Promise.race([
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, weekStartUTC))),
      taskTimeoutPromise,
    ])

    const weekMinutes = weekTasks.reduce((sum, t) => sum + (t.effortEstimate || 2) * 20, 0)
    const daysInWeek = Math.min(dayOfWeek === 0 ? 7 : dayOfWeek, 5)
    const weekTarget = daysInWeek * 180

    console.log("[Morning Summary] Week stats:", { tasksCount: weekTasks.length, weekMinutes, weekTarget })

    // Get stale clients (no activity in 2+ days)
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const staleClients: string[] = []

    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    for (const client of allClients) {
      if (client.type === "internal") continue

      const clientTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database query timeout")), 10000),
      )

      const lastTask = await Promise.race([
        db
          .select()
          .from(tasks)
          .where(and(eq(tasks.clientId, client.id), eq(tasks.status, "done")))
          .orderBy(desc(tasks.completedAt))
          .limit(1),
        clientTimeoutPromise,
      ])

      if (!lastTask[0]?.completedAt || lastTask[0].completedAt < twoDaysAgo) {
        staleClients.push(client.name)
      }
    }

    const deferredTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), 10000),
    )

    const deferredTaskEvents = await Promise.race([
      db
        .select({
          taskId: taskEvents.taskId,
          deferCount: sql<number>`COUNT(*)`.as("defer_count"),
        })
        .from(taskEvents)
        .where(sql`event_type IN ('deferred', 'demoted')`)
        .groupBy(taskEvents.taskId)
        .having(sql`COUNT(*) >= 2`),
      deferredTimeoutPromise,
    ])

    const deferredTasks: Array<{ title: string; deferCount: number }> = []

    for (const dt of deferredTaskEvents.slice(0, 3)) {
      const taskDetailsTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database query timeout")), 10000),
      )

      const [task] = await Promise.race([
        db.select({ title: tasks.title, status: tasks.status }).from(tasks).where(eq(tasks.id, dt.taskId)).limit(1),
        taskDetailsTimeoutPromise,
      ])

      if (task && task.status !== "done") {
        deferredTasks.push({ title: task.title, deferCount: dt.deferCount })
      }
    }

    // Sort by defer count descending
    deferredTasks.sort((a, b) => b.deferCount - a.deferCount)

    const message = formatMorningSummary({
      weekTasks: weekTasks.length,
      weekMinutes,
      weekTarget,
      bestDay: null,
      worstDay: null,
      staleClients,
      deferredTasks,
    })

    console.log("[Morning Summary] Message:", message)

    const result = await sendNotification(message, {
      title: "📅 Morning Briefing",
      tags: "sunrise,calendar",
      priority: "default",
    })

    return NextResponse.json({ ...result, message })
  } catch (error) {
    console.error("[Morning Summary] Error:", error)
    return NextResponse.json({ error: "Failed to send morning summary", details: String(error) }, { status: 500 })
  }
}
