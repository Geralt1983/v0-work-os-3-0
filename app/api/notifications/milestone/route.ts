import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNtfyNotification, getMilestoneEmoji, getMilestonePriority } from "@/lib/ntfy"

const MILESTONES = [25, 50, 75, 100, 125, 150]

export async function POST(request: Request) {
  try {
    const db = getDb()
    const today = new Date()
    const dateStr = today.toISOString().split("T")[0]
    today.setHours(0, 0, 0, 0)

    // Get today's completed moves
    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, today)))

    const earnedMinutes = completedToday.reduce((sum, m) => {
      const effort = m.effortEstimate || 2
      return sum + effort * 20
    }, 0)

    const targetMinutes = 180
    const currentPercent = Math.round((earnedMinutes / targetMinutes) * 100)

    // Get today's log to check which notifications were already sent
    const [todayLog] = await db.select().from(dailyLog).where(eq(dailyLog.date, dateStr))

    const sentNotifications: number[] = (todayLog?.notificationsSent as number[]) || []

    // Find the highest milestone we've reached that hasn't been notified
    const newMilestones = MILESTONES.filter((m) => currentPercent >= m && !sentNotifications.includes(m))

    if (newMilestones.length === 0) {
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

    await sendNtfyNotification({
      title: `${highestMilestone}% Progress`,
      message: milestoneMessages[highestMilestone] || `${highestMilestone}% complete`,
      priority: getMilestonePriority(highestMilestone),
      tags: [getMilestoneEmoji(highestMilestone), "workos"],
    })

    // Update daily log with sent notifications
    const updatedNotifications = [...sentNotifications, ...newMilestones]

    if (todayLog) {
      // Update existing log - we need raw SQL for this since drizzle doesn't handle jsonb updates well
      await db.update(dailyLog).set({ notificationsSent: updatedNotifications }).where(eq(dailyLog.id, todayLog.id))
    } else {
      // Create new log for today
      await db.insert(dailyLog).values({
        id: `log-${dateStr}`,
        date: dateStr,
        completedMoves: completedToday.map((m) => m.id),
        notificationsSent: updatedNotifications,
      })
    }

    return NextResponse.json({
      success: true,
      milestone: highestMilestone,
      currentPercent,
      earnedMinutes,
      notificationsSent: updatedNotifications,
    })
  } catch (error) {
    console.error("Milestone notification error:", error)
    return NextResponse.json({ error: "Failed to process milestone" }, { status: 500 })
  }
}
