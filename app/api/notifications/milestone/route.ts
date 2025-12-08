import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNtfyNotification, getMilestoneEmoji, getMilestonePriority } from "@/lib/ntfy"

const MILESTONES = [25, 50, 75, 100, 125, 150]

function getESTDate(): { dateStr: string; startOfDay: Date } {
  const now = new Date()
  // Convert to EST (UTC-5) or EDT (UTC-4)
  const estOffset = -5 * 60 // EST is UTC-5
  const utcOffset = now.getTimezoneOffset()
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)

  const dateStr = estTime.toISOString().split("T")[0]

  // Start of day in EST, converted back to UTC for DB comparison
  const startOfDay = new Date(`${dateStr}T00:00:00-05:00`)

  return { dateStr, startOfDay }
}

export async function POST(request: Request) {
  console.log("[v0] Milestone notification: Starting check")

  try {
    const db = getDb()
    const { dateStr, startOfDay } = getESTDate()

    console.log("[v0] Milestone: Using date", { dateStr, startOfDay: startOfDay.toISOString() })

    // Get today's completed moves
    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, startOfDay)))

    console.log("[v0] Milestone: Found completed moves", {
      count: completedToday.length,
      moves: completedToday.map((m) => ({ id: m.id, title: m.title, effort: m.effortEstimate })),
    })

    const earnedMinutes = completedToday.reduce((sum, m) => {
      const effort = m.effortEstimate || 2
      return sum + effort * 20
    }, 0)

    const targetMinutes = 180
    const currentPercent = Math.round((earnedMinutes / targetMinutes) * 100)

    console.log("[v0] Milestone: Progress calculated", { earnedMinutes, targetMinutes, currentPercent })

    // Get today's log to check which notifications were already sent
    let todayLog = null
    try {
      const logs = await db.select().from(dailyLog).where(eq(dailyLog.date, dateStr))
      todayLog = logs[0] || null
      console.log("[v0] Milestone: Today's log", todayLog)
    } catch (logErr) {
      console.log("[v0] Milestone: Error fetching daily log (table may not exist)", logErr)
    }

    const sentNotifications: number[] = (todayLog?.notificationsSent as number[]) || []

    // Find the highest milestone we've reached that hasn't been notified
    const newMilestones = MILESTONES.filter((m) => currentPercent >= m && !sentNotifications.includes(m))

    console.log("[v0] Milestone: Notification check", { sentNotifications, newMilestones, currentPercent })

    if (newMilestones.length === 0) {
      console.log("[v0] Milestone: No new milestones to notify")
      return NextResponse.json({ message: "No new milestones reached", currentPercent, sentNotifications })
    }

    // Send notification for the highest new milestone
    const highestMilestone = Math.max(...newMilestones)

    const milestoneMessages: Record<number, string> = {
      25: `Quarter way there! ${earnedMinutes} min earned. Keep the momentum!`,
      50: `Halfway point! ${earnedMinutes} min of ${targetMinutes}. Solid progress.`,
      75: `Three quarters done! ${earnedMinutes} min. The finish line is in sight!`,
      100: `TARGET HIT! ${earnedMinutes} min earned today. Outstanding work!`,
      125: `OVERACHIEVER! ${earnedMinutes} min - 125% of daily target!`,
      150: `CRUSHING IT! ${earnedMinutes} min - 150% of target! Legendary day!`,
    }

    console.log("[v0] Milestone: Sending notification for", highestMilestone)

    const ntfyResult = await sendNtfyNotification({
      title: `${getMilestoneEmoji(highestMilestone)} ${highestMilestone}% Progress`,
      message: milestoneMessages[highestMilestone] || `${highestMilestone}% complete`,
      priority: getMilestonePriority(highestMilestone),
      tags: [getMilestoneEmoji(highestMilestone), "workos"],
    })

    console.log("[v0] Milestone: NTFY result", ntfyResult)

    // Update daily log with sent notifications
    const updatedNotifications = [...sentNotifications, ...newMilestones]

    try {
      if (todayLog) {
        await db.update(dailyLog).set({ notificationsSent: updatedNotifications }).where(eq(dailyLog.id, todayLog.id))
      } else {
        await db.insert(dailyLog).values({
          id: `log-${dateStr}`,
          date: dateStr,
          completedMoves: completedToday.map((m) => m.id),
          notificationsSent: updatedNotifications,
        })
      }
      console.log("[v0] Milestone: Updated daily log with sent notifications", updatedNotifications)
    } catch (dbErr) {
      console.log("[v0] Milestone: Failed to update daily log (non-critical)", dbErr)
    }

    return NextResponse.json({
      success: true,
      milestone: highestMilestone,
      currentPercent,
      earnedMinutes,
      notificationsSent: updatedNotifications,
    })
  } catch (error) {
    console.error("[v0] Milestone notification error:", error)
    return NextResponse.json({ error: "Failed to process milestone", details: String(error) }, { status: 500 })
  }
}
