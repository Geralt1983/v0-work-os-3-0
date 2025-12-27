import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNtfyNotification } from "@/lib/ntfy"
import { getTaskPoints } from "@/lib/domain"
import { DAILY_TARGET_POINTS } from "@/lib/constants"

function getDayRating(percent: number): { rating: string; emoji: string } {
  if (percent >= 150) return { rating: "S", emoji: "star" }
  if (percent >= 125) return { rating: "A+", emoji: "fire" }
  if (percent >= 100) return { rating: "A", emoji: "tada" }
  if (percent >= 75) return { rating: "B", emoji: "thumbsup" }
  if (percent >= 50) return { rating: "C", emoji: "ok_hand" }
  if (percent >= 25) return { rating: "D", emoji: "thinking_face" }
  return { rating: "F", emoji: "disappointed" }
}

export async function POST() {
  try {
    const db = getDb()
    const today = new Date()
    const dateStr = today.toISOString().split("T")[0]
    today.setHours(0, 0, 0, 0)

    // Get today's completed tasks
    const completedToday = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, today)))

    const earnedPoints = completedToday.reduce((sum, t) => sum + getTaskPoints(t), 0)
    const targetPoints = DAILY_TARGET_POINTS
    const percent = Math.round((earnedPoints / targetPoints) * 100)
    const { rating, emoji } = getDayRating(percent)

    // Get clients touched today
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const clientsTouched = new Set(completedToday.map((m) => m.clientId).filter(Boolean))
    const clientNames = allClients.filter((c) => clientsTouched.has(c.id)).map((c) => c.name)

    // Build summary message
    let message = `Day Rating: ${rating} (${percent}%)\n`
    message += `Earned: ${earnedPoints} pts | Target: ${targetPoints} pts\n\n`

    message += `Tasks Completed (${completedToday.length}):\n`
    if (completedToday.length === 0) {
      message += "- No tasks completed today\n"
    } else {
      completedToday.slice(0, 5).forEach((t) => {
        const points = getTaskPoints(t)
        message += `- ${t.title} (${points}pt)\n`
      })
      if (completedToday.length > 5) {
        message += `- ...and ${completedToday.length - 5} more\n`
      }
    }

    message += `\nClients Touched (${clientNames.length}):\n`
    if (clientNames.length === 0) {
      message += "- None\n"
    } else {
      clientNames.forEach((name) => {
        message += `- ${name}\n`
      })
    }

    // Send notification
    await sendNtfyNotification({
      title: `4PM Daily Summary - ${rating}`,
      message,
      priority: percent >= 100 ? 4 : 3,
      tags: [emoji, "sunset", "workos"],
    })

    // Update daily log
    const [existingLog] = await db.select().from(dailyLog).where(eq(dailyLog.date, dateStr))

    const logData = {
      completedTasks: completedToday.map((t) => t.id),
      clientsTouched: Array.from(clientsTouched),
      summary: `${rating} day - ${percent}% (${earnedPoints}pts)`,
    }

    if (existingLog) {
      await db.update(dailyLog).set(logData).where(eq(dailyLog.id, existingLog.id))
    } else {
      await db.insert(dailyLog).values({
        id: `log-${dateStr}`,
        date: dateStr,
        ...logData,
        notificationsSent: [],
      })
    }

    return NextResponse.json({
      success: true,
      rating,
      percent,
      earnedPoints,
      completedCount: completedToday.length,
    })
  } catch (error) {
    console.error("Evening notification error:", error)
    return NextResponse.json({ error: "Failed to send evening notification" }, { status: 500 })
  }
}
