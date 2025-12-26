import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNtfyNotification } from "@/lib/ntfy"

export async function POST() {
  try {
    const db = getDb()
    const now = new Date()

    // Get start of current week (Monday)
    const startOfWeek = new Date(now)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)

    // Get this week's completed tasks
    const weekTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, startOfWeek)))

    const weekEarnedMinutes = weekTasks.reduce((sum, t) => sum + (t.effortEstimate || 2) * 20, 0)
    const weekTargetMinutes = 180 * 5 // 5 days
    const weekPercent = Math.round((weekEarnedMinutes / weekTargetMinutes) * 100)

    // Get day of week (1-5 for Mon-Fri)
    const dayOfWeek = now.getDay() || 7 // Convert Sunday (0) to 7
    const workDaysPassed = Math.min(dayOfWeek - 1, 4) // 0-4 work days passed
    const expectedPercent = Math.round((workDaysPassed / 5) * 100)

    // Get active tasks count
    const activeTasks = await db.select().from(tasks).where(eq(tasks.status, "active"))

    const queuedTasks = await db.select().from(tasks).where(eq(tasks.status, "queued"))

    // Calculate barriers (stale clients - no activity in 3+ days)
    const threeDaysAgo = new Date(now)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const allTasks = await db.select().from(tasks)

    const staleClients = allClients.filter((client) => {
      const clientTasks = allTasks.filter((t) => t.clientId === client.id && t.status === "done")
      if (clientTasks.length === 0) return true
      const lastTask = clientTasks.sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      return !lastTask.completedAt || lastTask.completedAt < threeDaysAgo
    })

    // Build status message
    const weekStatus = weekPercent >= expectedPercent ? "on track" : "behind pace"
    const paceEmoji = weekPercent >= expectedPercent ? "white_check_mark" : "warning"

    let message = `Week Progress: ${weekPercent}% (${weekStatus})\n`
    message += `${weekEarnedMinutes} min earned of ${weekTargetMinutes} min weekly target\n\n`
    message += `Today's Setup:\n`
    message += `- ${activeTasks.length} active task(s)\n`
    message += `- ${queuedTasks.length} queued task(s)\n\n`

    if (staleClients.length > 0) {
      message += `Barriers (${staleClients.length} stale clients):\n`
      staleClients.slice(0, 3).forEach((c) => {
        message += `- ${c.name} needs attention\n`
      })
      if (staleClients.length > 3) {
        message += `- ...and ${staleClients.length - 3} more\n`
      }
    } else {
      message += `No barriers - all clients healthy!\n`
    }

    // Recent successes (tasks completed in last 2 days)
    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const recentTasks = weekTasks.filter((t) => t.completedAt && t.completedAt >= twoDaysAgo)

    if (recentTasks.length > 0) {
      message += `\nRecent Wins (${recentTasks.length} tasks):\n`
      recentTasks.slice(0, 3).forEach((t) => {
        message += `- ${t.title}\n`
      })
    }

    await sendNtfyNotification({
      title: "8AM Status Report",
      message,
      priority: 3,
      tags: [paceEmoji, "sunrise", "workos"],
    })

    return NextResponse.json({
      success: true,
      weekPercent,
      weekStatus,
      staleClients: staleClients.length,
      activeTasks: activeTasks.length,
    })
  } catch (error) {
    console.error("Morning notification error:", error)
    return NextResponse.json({ error: "Failed to send morning notification" }, { status: 500 })
  }
}
