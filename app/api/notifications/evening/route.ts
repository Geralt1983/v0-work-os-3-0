import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNtfyNotification } from "@/lib/ntfy"

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

    const earnedMinutes = completedToday.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)
    const targetMinutes = 180
    const percent = Math.round((earnedMinutes / targetMinutes) * 100)
    const { rating, emoji } = getDayRating(percent)

    // Calculate hours worked (based on effort with 1.5x multiplier for overhead)
    const hoursWorked = ((earnedMinutes * 1.5) / 60).toFixed(1)

    // Get clients touched today
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const clientsTouched = new Set(completedToday.map((m) => m.clientId).filter(Boolean))
    const clientNames = allClients.filter((c) => clientsTouched.has(c.id)).map((c) => c.name)

    // Build summary message
    let message = `Day Rating: ${rating} (${percent}%)\n`
    message += `Earned: ${earnedMinutes} min | Target: ${targetMinutes} min\n`
    message += `Hours invested: ~${hoursWorked}h\n\n`

    message += `Tasks Completed (${completedToday.length}):\n`
    if (completedToday.length === 0) {
      message += "- No tasks completed today\n"
    } else {
      completedToday.slice(0, 5).forEach((m) => {
        const effort = m.effortEstimate || 2
        message += `- ${m.title} (${effort * 20}min)\n`
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
      summary: `${rating} day - ${percent}% (${earnedMinutes}min)`,
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
      earnedMinutes,
      hoursWorked,
      completedCount: completedToday.length,
    })
  } catch (error) {
    console.error("Evening notification error:", error)
    return NextResponse.json({ error: "Failed to send evening notification" }, { status: 500 })
  }
}
