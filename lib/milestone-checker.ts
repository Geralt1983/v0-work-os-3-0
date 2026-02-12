import { getDb } from "@/lib/db"
import { dailyLog, dailyGoals } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { sendMilestoneAlert } from "@/lib/notifications"
import { MILESTONES } from "@/lib/constants"
import { getESTDateString, getESTTodayStart, estToUTC } from "@/lib/domain/timezone"

function getESTDate(): { dateStr: string; startOfDay: Date } {
  const now = new Date()
  const dateStr = getESTDateString(now)
  const startOfDay = estToUTC(getESTTodayStart(now))
  return { dateStr, startOfDay }
}

interface MilestoneCheckParams {
  earnedPoints?: number
  targetPoints?: number
  currentStreak?: number
  taskCount?: number
}

export async function checkAndSendMilestone(params?: MilestoneCheckParams) {
  console.log("[milestone-checker] Starting check")

  try {
    const db = getDb()
    const { dateStr, startOfDay } = getESTDate()

    console.log("[milestone-checker] Checking for date:", dateStr, "startOfDay:", startOfDay.toISOString())

    let earnedPoints: number
    let targetPoints: number
    let currentStreak: number
    let taskCount: number

    // Use provided params if available (from task completion), otherwise query database
    if (params?.earnedPoints !== undefined) {
      earnedPoints = params.earnedPoints
      targetPoints = params.targetPoints ?? 18
      currentStreak = params.currentStreak ?? 0
      taskCount = params.taskCount ?? 0
      console.log("[milestone-checker] Using provided params:", { earnedPoints, targetPoints, currentStreak, taskCount })
    } else {
      // Get today's goals for points, task count, and streak info
      const [todayGoal] = await db
        .select()
        .from(dailyGoals)
        .where(eq(dailyGoals.date, dateStr))
        .limit(1)

      earnedPoints = todayGoal?.earnedPoints || 0
      targetPoints = todayGoal?.targetPoints || 18
      currentStreak = todayGoal?.currentStreak || 0
      taskCount = todayGoal?.taskCount || 0
      console.log("[milestone-checker] Queried from database:", { earnedPoints, targetPoints, currentStreak, taskCount })
    }

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
