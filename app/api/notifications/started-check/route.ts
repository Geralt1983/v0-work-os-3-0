import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"

const NY_TZ = "America/New_York"

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function toYyyyMmDd(parts: Pick<ZonedParts, "year" | "month" | "day">): string {
  const mm = String(parts.month).padStart(2, "0")
  const dd = String(parts.day).padStart(2, "0")
  return `${parts.year}-${mm}-${dd}`
}

// Convert a wall-clock time in a specific zone into a UTC Date (DST-aware).
function zonedTimeToUtcDate(timeZone: string, desired: Omit<ZonedParts, "minute" | "second"> & Partial<Pick<ZonedParts, "minute" | "second">>): Date {
  const minute = desired.minute ?? 0
  const second = desired.second ?? 0

  // Start with a naive UTC construction; then iteratively correct based on the
  // time-zone formatted parts until the zone's wall-clock matches the desired parts.
  let utc = new Date(Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, minute, second))
  const desiredUtcLike = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, minute, second)

  for (let i = 0; i < 3; i++) {
    const current = getZonedParts(utc, timeZone)
    const currentUtcLike = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute, current.second)
    const deltaMs = desiredUtcLike - currentUtcLike
    if (deltaMs === 0) break
    utc = new Date(utc.getTime() + deltaMs)
  }

  return utc
}

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
