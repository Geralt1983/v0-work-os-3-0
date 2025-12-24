import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, dailyLog, clients, dailyGoals } from "@/lib/schema"
import { eq, sql } from "drizzle-orm"
import { logMoveEvent } from "@/lib/events"
import { sendNotification } from "@/lib/notifications"

// POST mark move as complete
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const moveId = Number.parseInt(id)
    const body = await request.json().catch(() => ({}))

    const [currentMove] = await db
      .select({
        status: moves.status,
        complexityAiGuess: moves.complexityAiGuess,
        complexityFinal: moves.complexityFinal,
      })
      .from(moves)
      .where(eq(moves.id, moveId))
      .limit(1)

    const [updated] = await db
      .update(moves)
      .set({
        status: "done",
        completedAt: new Date(),
        effortActual: body.effortActual || null,
        updatedAt: new Date(),
      })
      .where(eq(moves.id, moveId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 })
    }

    await logMoveEvent({
      moveId,
      eventType: "completed",
      fromStatus: currentMove?.status,
      toStatus: "done",
    })

    // ============================================
    // DAILY GOALS - COMPLEXITY TRACKING
    // ============================================
    try {
      const complexity = currentMove?.complexityFinal || currentMove?.complexityAiGuess || 3
      const now = new Date()
      const estOffset = -5 * 60
      const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
      const todayDate = estNow.toISOString().split("T")[0]

      // Upsert into daily_goals
      await db
        .insert(dailyGoals)
        .values({
          date: todayDate,
          earnedComplexity: complexity,
          moveCount: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: dailyGoals.date,
          set: {
            earnedComplexity: sql`${dailyGoals.earnedComplexity} + ${complexity}`,
            moveCount: sql`${dailyGoals.moveCount} + 1`,
            updatedAt: now,
          },
        })

      console.log(`[COMPLEXITY] Added ${complexity} points for move ${moveId}`)
    } catch (complexityError) {
      console.error("[COMPLEXITY] Failed to update daily goals:", complexityError)
    }

    // ============================================
    // "WORK STARTED" NOTIFICATION LOGIC
    // ============================================

    try {
      console.log("[WORK STARTED] Starting notification check...")

      const now = new Date()
      const estOffset = -5 * 60
      const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
      const todayStr = estNow.toISOString().split("T")[0]

      console.log("[WORK STARTED] Today (EST):", todayStr)

      // Check if we already sent "work started" notification today
      const todayLogResult = await db.select().from(dailyLog).where(eq(dailyLog.date, todayStr)).limit(1)

      const todayLogEntry = todayLogResult[0]

      console.log("[WORK STARTED] Daily log entry:", todayLogEntry)
      console.log("[WORK STARTED] Already notified?", todayLogEntry?.workStartedNotified)

      if (todayLogEntry?.workStartedNotified) {
        console.log("[WORK STARTED] Already notified today, skipping")
        return NextResponse.json(updated)
      }

      // This is the first completion today - send notification!
      console.log("[WORK STARTED] First completion today! Sending notification...")

      const hour = estNow.getHours()
      const minute = estNow.getMinutes()
      const ampm = hour >= 12 ? "PM" : "AM"
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const timeStr = `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`

      // Get the completed move with client info using explicit join
      const completedMoveResult = await db
        .select({
          id: moves.id,
          title: moves.title,
          clientId: moves.clientId,
          clientName: clients.name,
        })
        .from(moves)
        .leftJoin(clients, eq(moves.clientId, clients.id))
        .where(eq(moves.id, moveId))
        .limit(1)

      const completedMove = completedMoveResult[0]
      const clientName = completedMove?.clientName || "Unknown"
      const moveTitle = completedMove?.title || "a task"

      console.log("[WORK STARTED] Move details:", { moveTitle, clientName, timeStr })

      // Playful message variations
      const messages = [
        `🎬 Jeremy is officially on the clock!\n\nFirst move: "${moveTitle}" (${clientName})\nTime: ${timeStr}`,
        `🟢 Jeremy has started working!\n\n✅ "${moveTitle}" for ${clientName}\n⏰ ${timeStr}`,
        `💼 He's alive! Jeremy just knocked out his first move.\n\n"${moveTitle}" (${clientName}) at ${timeStr}`,
        `🚀 Work mode activated!\n\nJeremy completed: "${moveTitle}"\nClient: ${clientName}\nTime: ${timeStr}`,
      ]

      const message = messages[Math.floor(Math.random() * messages.length)]

      console.log("[WORK STARTED] Sending message:", message)

      const notificationResult = await sendNotification(message, "Work Started")

      console.log("[WORK STARTED] Notification result:", notificationResult)

      // Mark as notified - create or update daily log
      if (todayLogEntry) {
        console.log("[WORK STARTED] Updating existing log entry...")
        await db
          .update(dailyLog)
          .set({
            workStartedNotified: true,
            workStartedAt: now,
          })
          .where(eq(dailyLog.id, todayLogEntry.id))
      } else {
        console.log("[WORK STARTED] Creating new log entry...")
        await db.insert(dailyLog).values({
          id: `log-${todayStr}`,
          date: todayStr,
          workStartedNotified: true,
          workStartedAt: now,
          completedMoves: [moveId],
          clientsTouched: completedMove?.clientId ? [completedMove.clientId] : [],
          notificationsSent: ["work_started"],
        })
      }

      console.log("[WORK STARTED] Successfully marked as notified")
    } catch (notificationError) {
      console.error("[WORK STARTED] Notification failed:", notificationError)
      console.error("[WORK STARTED] Error details:", {
        message: notificationError instanceof Error ? notificationError.message : String(notificationError),
        stack: notificationError instanceof Error ? notificationError.stack : undefined,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to complete move:", error)
    return NextResponse.json({ error: "Failed to complete move" }, { status: 500 })
  }
}
