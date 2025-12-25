import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken) return true // No secret configured, allow
  if (!authHeader) return false

  const token = authHeader.replace("Bearer ", "")
  return token === expectedToken
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get today's date in EST
    const now = new Date()
    const estOffset = -5 * 60 // EST is UTC-5
    const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
    const todayStr = estNow.toISOString().split("T")[0]

    const db = await getDb()
    const todayLogResult = await db.select().from(dailyLog).where(eq(dailyLog.date, todayStr)).limit(1)

    const todayLogEntry = todayLogResult[0]

    if (todayLogEntry?.workStartedNotified) {
      return NextResponse.json({
        sent: false,
        reason: "Already notified today",
      })
    }

    // Check for any completed tasks today
    const todayStart = new Date(todayStr + "T00:00:00-05:00") // EST

    const completedToday = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayStart)))
      .orderBy(tasks.completedAt)
      .limit(1)

    if (completedToday.length === 0) {
      // No work done yet - send a nudge!
      const hour = estNow.getHours()

      let message = ""
      if (hour >= 10 && hour < 11) {
        message = `⏰ It's ${hour}am and no tasks completed yet.\nTime to get rolling!`
      } else if (hour >= 11) {
        message = `🚨 It's ${hour}am - still no tasks today!\nEven one quick win counts.`
      }

      if (message) {
        await sendNotification(message, { title: "Work Check" })

        // Don't mark as "started" - we're nudging because NOT started
        return NextResponse.json({
          sent: true,
          type: "nudge",
          message,
        })
      }

      return NextResponse.json({
        sent: false,
        reason: "Too early to nudge",
      })
    }

    // Work has started! This shouldn't happen via cron (we send on first completion)
    // But handle it gracefully
    return NextResponse.json({
      sent: false,
      reason: "Work already started - notification sent on completion",
    })
  } catch (error) {
    console.error("Started check failed:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export const maxDuration = 60
