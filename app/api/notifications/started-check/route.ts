import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"
import { NY_TZ, getZonedParts, toYyyyMmDd, zonedTimeToUtcDate } from "@/lib/domain/timezone"

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
    const now = new Date()
    const nyNow = getZonedParts(now, NY_TZ)
    const todayStr = toYyyyMmDd(nyNow)

    const db = getDb()
    const todayLogResult = await db.select().from(dailyLog).where(eq(dailyLog.date, todayStr)).limit(1)

    const todayLogEntry = todayLogResult[0]

    if (todayLogEntry?.workStartedNotified) {
      return NextResponse.json({
        sent: false,
        reason: "Already notified today",
      })
    }

    // Check for any completed tasks today
    const todayStart = zonedTimeToUtcDate(NY_TZ, { year: nyNow.year, month: nyNow.month, day: nyNow.day, hour: 0, minute: 0, second: 0 })

    const completedToday = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayStart)))
      .orderBy(tasks.completedAt)
      .limit(1)

    if (completedToday.length === 0) {
      // No work done yet - send a nudge!
      const hour = nyNow.hour

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
    const message = error instanceof Error ? error.message : String(error)
    console.error("Started check failed:", { message, error })
    return NextResponse.json({ error: "Failed", details: message }, { status: 500 })
  }
}

export const maxDuration = 60
