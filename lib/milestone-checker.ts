import { getDb } from "@/lib/db"
import { dailyLog, dailyGoals } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { sendMilestoneAlert } from "@/lib/notifications"
import { MILESTONES } from "@/lib/constants"

function getESTDate(): { dateStr: string; startOfDay: Date } {
  const now = new Date()
  const estOffset = -5 * 60
  const utcOffset = now.getTimezoneOffset()
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)
  const dateStr = estTime.toISOString().split("T")[0]
  const startOfDay = new Date(`${dateStr}T00:00:00-05:00`)
  return { dateStr, startOfDay }
}

export async function checkAndSendMilestone() {
  console.log("[milestone-checker] Starting check")

  try {
    const db = getDb()
    const { dateStr, startOfDay } = getESTDate()

    console.log("[milestone-checker] Checking for date:", dateStr, "startOfDay:", startOfDay.toISOString())

    // Get today's goals for points, task count, and streak info
    const [todayGoal] = await db
      .select()
      .from(dailyGoals)
      .where(eq(dailyGoals.date, dateStr))
      .limit(1)

    const earnedPoints = todayGoal?.earnedPoints || 0
    const targetPoints = todayGoal?.targetPoints || 18
    const currentStreak = todayGoal?.currentStreak || 0
    const taskCount = todayGoal?.taskCount || 0

    const currentPercent = Math.round((earnedPoints / targetPoints) * 100)

    console.log("[milestone-checker] Progress:", {
      earnedPoints,
      targetPoints,
      currentPercent,
      taskCount,
      currentStreak,
    })

    let todayLog = null
    try {
      const logs = await db.select().from(dailyLog).where(eq(dailyLog.date, dateStr))
      todayLog = logs[0] || null
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
        earnedPoints,
        sentNotifications,
      }
    }

    const highestMilestone = Math.max(...newMilestones)
    console.log("[milestone-checker] Sending notification for", highestMilestone)

    const result = await sendMilestoneAlert({
      percent: highestMilestone,
      taskCount,
      earnedPoints,
      targetPoints,
      currentStreak,
    })
    console.log("[milestone-checker] Notification result:", result)

    const updatedNotifications = [...sentNotifications, ...newMilestones]
    try {
      if (todayLog) {
        await db.update(dailyLog).set({ notificationsSent: updatedNotifications }).where(eq(dailyLog.id, todayLog.id))
      } else {
        await db.insert(dailyLog).values({
          id: `log-${dateStr}`,
          date: dateStr,
          completedTasks: [],
          notificationsSent: updatedNotifications,
        })
      }
    } catch (dbErr) {
      console.error("[milestone-checker] Failed to update daily log:", dbErr)
    }

    return {
      success: result.success,
      milestone: highestMilestone,
      currentPercent,
      earnedPoints,
      notificationsSent: updatedNotifications,
    }
  } catch (error) {
    console.error("[milestone-checker] Error:", error)
    return { error: "Failed to process milestone", details: String(error) }
  }
}
