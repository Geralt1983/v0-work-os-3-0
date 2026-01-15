import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, dailyLog, clients, dailyGoals } from "@/lib/schema"
import { eq, sql } from "drizzle-orm"
import { logTaskEvent } from "@/lib/events"
import { sendNotification } from "@/lib/notifications"
import { checkAndSendMilestone } from "@/lib/milestone-checker"
import { getTaskPoints } from "@/lib/domain"

// POST mark task as complete
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const taskId = Number.parseInt(id, 10)
    const body = await request.json().catch(() => ({}))

    const [currentTask] = await db
      .select({
        status: tasks.status,
        title: tasks.title,
        valueTier: tasks.valueTier, // Added for accurate points
        pointsAiGuess: tasks.pointsAiGuess,
        pointsFinal: tasks.pointsFinal,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)

    const [updated] = await db
      .update(tasks)
      .set({
        status: "done",
        completedAt: new Date(),
        effortActual: body.effortActual || null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    await logTaskEvent({
      taskId,
      eventType: "completed",
      fromStatus: currentTask?.status,
      toStatus: "done",
    })

    // ============================================
    // DAILY GOALS - POINTS TRACKING WITH STREAKS
    // ============================================
    let hitGoalToday = false
    let currentStreak = 0

    try {
      // Use standard domain logic for points
      const points = getTaskPoints(currentTask || {})
      const now = new Date()
      const estOffset = -5 * 60
      const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
      const todayDate = estNow.toISOString().split("T")[0]

      // Get current daily goals entry
      const [existingGoal] = await db
        .select()
        .from(dailyGoals)
        .where(eq(dailyGoals.date, todayDate))
        .limit(1)

      const newEarnedPoints = (existingGoal?.earnedPoints || 0) + points
      const targetPoints = existingGoal?.targetPoints || 18

      // Check if we just hit the goal
      const wasUnderGoal = (existingGoal?.earnedPoints || 0) < targetPoints
      hitGoalToday = newEarnedPoints >= targetPoints

      // Calculate streak
      if (hitGoalToday && wasUnderGoal) {
        // Just hit goal! Calculate streak
        const yesterday = new Date(estNow)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split("T")[0]

        const lastGoalHit = existingGoal?.lastGoalHitDate

        if (lastGoalHit === yesterdayStr) {
          // Consecutive day - increment streak
          currentStreak = (existingGoal?.currentStreak || 0) + 1
        } else {
          // Not consecutive - start new streak
          currentStreak = 1
        }

        const longestStreak = Math.max(existingGoal?.longestStreak || 0, currentStreak)

        // Update with streak info
        await db
          .insert(dailyGoals)
          .values({
            date: todayDate,
            earnedPoints: points,
            taskCount: 1,
            currentStreak,
            longestStreak,
            lastGoalHitDate: todayDate,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: dailyGoals.date,
            set: {
              earnedPoints: sql`${dailyGoals.earnedPoints} + ${points}`,
              taskCount: sql`${dailyGoals.taskCount} + 1`,
              currentStreak,
              longestStreak,
              lastGoalHitDate: todayDate,
              updatedAt: now,
            },
          })

        console.log(`[POINTS] Goal hit! Streak: ${currentStreak}, Longest: ${longestStreak}`)
      } else {
        // Regular update without streak change
        await db
          .insert(dailyGoals)
          .values({
            date: todayDate,
            earnedPoints: points,
            taskCount: 1,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: dailyGoals.date,
            set: {
              earnedPoints: sql`${dailyGoals.earnedPoints} + ${points}`,
              taskCount: sql`${dailyGoals.taskCount} + 1`,
              updatedAt: now,
            },
          })
      }

      console.log(`[POINTS] Added ${points} points for task ${taskId}`)
    } catch (pointsError) {
      console.error("[POINTS] Failed to update daily goals:", pointsError)
    }

    // ============================================
    // MILESTONE NOTIFICATIONS - DISABLED (Too noisy)
    // ============================================
    /*
    try {
      // Pass the updated values directly to avoid race condition
      await checkAndSendMilestone({
        earnedPoints: newEarnedPoints,
        targetPoints,
        currentStreak,
        taskCount: (existingGoal?.taskCount || 0) + 1,
      })
      console.log("[MILESTONE] Milestone check completed")
    } catch (milestoneError) {
      console.error("[MILESTONE] Failed to check milestone:", milestoneError)
    }
    */

    // ============================================
    // TASK COMPLETION NOTIFICATION
    // ============================================
    try {
      const points = getTaskPoints(currentTask || {})
      const taskTitle = currentTask?.title || "Task"

      await sendNotification(`✅ Completed: ${taskTitle} (${points} pts)`, {
        title: "Task Complete",
        priority: "default",
        tags: "white_check_mark"
      })
    } catch (e) {
      console.error("Failed to send completion notification", e)
    }

    // ============================================
    // "WORK STARTED" NOTIFICATION LOGIC
    // ============================================
    try {
      const now = new Date()
      const estOffset = -5 * 60
      const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
      const todayStr = estNow.toISOString().split("T")[0]

      // Check if we already sent "work started" notification today
      const todayLogResult = await db.select().from(dailyLog).where(eq(dailyLog.date, todayStr)).limit(1)
      const todayLogEntry = todayLogResult[0]

      if (todayLogEntry?.workStartedNotified) {
        return NextResponse.json({ ...updated, hitGoalToday, currentStreak })
      }

      // This is the first completion today - send notification!
      const hour = estNow.getHours()
      const minute = estNow.getMinutes()
      const ampm = hour >= 12 ? "PM" : "AM"
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const timeStr = `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`

      // Get the completed task with client info
      const completedTaskResult = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          clientId: tasks.clientId,
          clientName: clients.name,
        })
        .from(tasks)
        .leftJoin(clients, eq(tasks.clientId, clients.id))
        .where(eq(tasks.id, taskId))
        .limit(1)

      const completedTask = completedTaskResult[0]
      const clientName = completedTask?.clientName || "Unknown"
      const taskTitle = completedTask?.title || "a task"

      // Playful message variations
      const messages = [
        `🎬 Jeremy is officially on the clock!\n\nFirst task: "${taskTitle}" (${clientName})\nTime: ${timeStr}`,
        `🟢 Jeremy has started working!\n\n✅ "${taskTitle}" for ${clientName}\n⏰ ${timeStr}`,
        `💼 He's alive! Jeremy just knocked out his first task.\n\n"${taskTitle}" (${clientName}) at ${timeStr}`,
        `🚀 Work mode activated!\n\nJeremy completed: "${taskTitle}"\nClient: ${clientName}\nTime: ${timeStr}`,
      ]

      const message = messages[Math.floor(Math.random() * messages.length)]
      await sendNotification(message, { title: "Work Started" })

      // Mark as notified - create or update daily log
      if (todayLogEntry) {
        await db
          .update(dailyLog)
          .set({
            workStartedNotified: true,
            workStartedAt: now,
          })
          .where(eq(dailyLog.id, todayLogEntry.id))
      } else {
        await db.insert(dailyLog).values({
          id: `log-${todayStr}`,
          date: todayStr,
          workStartedNotified: true,
          workStartedAt: now,
          completedTasks: [taskId],
          clientsTouched: completedTask?.clientId ? [completedTask.clientId] : [],
          notificationsSent: ["work_started"],
        })
      }
    } catch (notificationError) {
      console.error("[WORK STARTED] Notification failed:", notificationError)
    }

    return NextResponse.json({ ...updated, hitGoalToday, currentStreak })
  } catch (error) {
    console.error("Failed to complete task:", error)
    return NextResponse.json({ error: "Failed to complete task" }, { status: 500 })
  }
}
