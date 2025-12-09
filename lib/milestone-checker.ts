import { getDb } from "@/lib/db"
import { moves, dailyLog } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendMilestoneAlert } from "@/lib/notifications"

const MILESTONES = [25, 50, 75, 100, 125, 150]

function getESTDate(): { dateStr: string; startOfDay: Date } {
  const now = new Date()
  // EST is UTC-5, but during daylight saving (EDT) it's UTC-4
  // For simplicity, using -5 (EST)
  const estOffset = -5 * 60
  const utcOffset = now.getTimezoneOffset()
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)
  const dateStr = estTime.toISOString().split("T")[0]
  // Create start of day in EST timezone
  const startOfDay = new Date(`${dateStr}T00:00:00-05:00`)
  return { dateStr, startOfDay }
}

export async function checkAndSendMilestone() {
  console.log("[milestone-checker] Starting check")

  try {
    const db = getDb()
    const { dateStr, startOfDay } = getESTDate()

    console.log("[milestone-checker] Checking for date:", dateStr, "startOfDay:", startOfDay.toISOString())

    // Get today's completed moves
    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, startOfDay)))

    const earnedMinutes = completedToday.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)
    const targetMinutes = 180
    const currentPercent = Math.round((earnedMinutes / targetMinutes) * 100)

    console.log("[milestone-checker] Progress:", {
      earnedMinutes,
      currentPercent,
      movesCount: completedToday.length,
      moves: completedToday.map((m) => ({ id: m.id, effort: m.effortEstimate })),
    })

    // Get today's log to check which notifications were already sent
    let todayLog = null
    try {
      const logs = await db.select().from(dailyLog).where(eq(dailyLog.date, dateStr))
      todayLog = logs[0] || null
      console.log("[milestone-checker] Today's log:", todayLog)
    } catch (err) {
      console.log("[milestone-checker] Error fetching daily log:", err)
    }

    const sentNotifications: number[] = (todayLog?.notificationsSent as number[]) || []
    const newMilestones = MILESTONES.filter((m) => currentPercent >= m && !sentNotifications.includes(m))

    console.log("[milestone-checker] Sent notifications:", sentNotifications)
    console.log("[milestone-checker] New milestones to send:", newMilestones)

    if (newMilestones.length === 0) {
      return {
        message: "No new milestones",
        currentPercent,
        earnedMinutes,
        sentNotifications,
      }
    }

    // Send notification for the highest new milestone
    const highestMilestone = Math.max(...newMilestones)
    console.log("[milestone-checker] Sending notification for", highestMilestone)

    const result = await sendMilestoneAlert(highestMilestone, completedToday.length)
    console.log("[milestone-checker] Notification result:", result)

    // Update daily log
    const updatedNotifications = [...sentNotifications, ...newMilestones]
    try {
      if (todayLog) {
        await db.update(dailyLog).set({ notificationsSent: updatedNotifications }).where(eq(dailyLog.id, todayLog.id))
        console.log("[milestone-checker] Updated existing log")
      } else {
        await db.insert(dailyLog).values({
          id: `log-${dateStr}`,
          date: dateStr,
          completedMoves: completedToday.map((m) => m.id),
          notificationsSent: updatedNotifications,
        })
        console.log("[milestone-checker] Created new log")
      }
    } catch (dbErr) {
      console.error("[milestone-checker] Failed to update daily log:", dbErr)
    }

    return {
      success: result.success,
      milestone: highestMilestone,
      currentPercent,
      earnedMinutes,
      notificationsSent: updatedNotifications,
    }
  } catch (error) {
    console.error("[milestone-checker] Error:", error)
    return { error: "Failed to process milestone", details: String(error) }
  }
}
