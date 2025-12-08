import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendMilestoneAlert } from "@/lib/notifications"

const MILESTONES = [25, 50, 75, 100, 125, 150]

function getESTDate(): { dateStr: string; startOfDay: Date } {
  const now = new Date()
  const estOffset = -5 * 60
  const utcOffset = now.getTimezoneOffset()
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)
  const dateStr = estTime.toISOString().split("T")[0]
  const startOfDay = new Date(`${dateStr}T00:00:00-05:00`)
  return { dateStr, startOfDay }
}

export async function POST() {
  console.log("[Milestone] Starting check")

  try {
    const db = getDb()
    const { dateStr, startOfDay } = getESTDate()

    // Get today's completed moves
    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, startOfDay)))

    const earnedMinutes = completedToday.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)
    const targetMinutes = 180
    const currentPercent = Math.round((earnedMinutes / targetMinutes) * 100)

    console.log("[Milestone] Progress:", { earnedMinutes, currentPercent, movesCount: completedToday.length })

    // Get today's log to check which notifications were already sent
    let todayLog = null
    try {
      const logs = await db.select().from(dailyLog).where(eq(dailyLog.date, dateStr))
      todayLog = logs[0] || null
    } catch (err) {
      console.log("[Milestone] Error fetching daily log:", err)
    }

    const sentNotifications: number[] = (todayLog?.notificationsSent as number[]) || []
    const newMilestones = MILESTONES.filter((m) => currentPercent >= m && !sentNotifications.includes(m))

    if (newMilestones.length === 0) {
      return NextResponse.json({ message: "No new milestones", currentPercent, sentNotifications })
    }

    // Send notification for the highest new milestone
    const highestMilestone = Math.max(...newMilestones)
    console.log("[Milestone] Sending notification for", highestMilestone)

    const result = await sendMilestoneAlert(highestMilestone, completedToday.length)
    console.log("[Milestone] Notification result:", result)

    // Update daily log
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
    } catch (dbErr) {
      console.log("[Milestone] Failed to update daily log:", dbErr)
    }

    return NextResponse.json({
      success: result.success,
      milestone: highestMilestone,
      currentPercent,
      earnedMinutes,
      notificationsSent: updatedNotifications,
    })
  } catch (error) {
    console.error("[Milestone] Error:", error)
    return NextResponse.json({ error: "Failed to process milestone", details: String(error) }, { status: 500 })
  }
}
