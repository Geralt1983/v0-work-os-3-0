import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, dailyLog } from "@/lib/schema"
import { eq } from "drizzle-orm"
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
      .select({ status: moves.status })
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
    // "WORK STARTED" NOTIFICATION LOGIC
    // ============================================
    
    try {
      // Get current time in EST
      const now = new Date()
      const estOffset = -5 * 60 // EST is UTC-5
      const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
      const todayStr = estNow.toISOString().split('T')[0]
      
      // Check if we already sent "work started" notification today
      let todayLogEntry = await db.query.dailyLog.findFirst({
        where: eq(dailyLog.date, todayStr),
      })
      
      // Create today's log if it doesn't exist
      if (!todayLogEntry) {
        const [newLog] = await db.insert(dailyLog).values({
          date: todayStr,
          completedMoves: 1,
          workStartedNotified: false,
        }).returning()
        todayLogEntry = newLog
      }
      
      // Send "work started" notification if not yet sent today
      if (todayLogEntry && !todayLogEntry.workStartedNotified) {
        const hour = estNow.getHours()
        const minute = estNow.getMinutes()
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
        const timeStr = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`
        
        // Get the completed move with client info
        const completedMove = await db.query.moves.findFirst({
          where: eq(moves.id, moveId),
          with: { client: true },
        })
        
        const clientName = completedMove?.client?.name || 'Unknown'
        const moveTitle = completedMove?.title || 'a task'
        
        // Playful message variations
        const messages = [
          `🎬 Jeremy is officially on the clock!\n\nFirst move: "${moveTitle}" (${clientName})\nTime: ${timeStr}`,
          `🟢 Jeremy has started working!\n\n✅ "${moveTitle}" for ${clientName}\n⏰ ${timeStr}`,
          `💼 He's alive! Jeremy just knocked out his first move.\n\n"${moveTitle}" (${clientName}) at ${timeStr}`,
          `🚀 Work mode activated!\n\nJeremy completed: "${moveTitle}"\nClient: ${clientName}\nTime: ${timeStr}`,
        ]
        
        // Pick a random message
        const message = messages[Math.floor(Math.random() * messages.length)]
        
        await sendNotification(message, 'Work Started')
        
        // Mark as notified
        await db.update(dailyLog)
          .set({ 
            workStartedNotified: true,
            workStartedAt: now,
          })
          .where(eq(dailyLog.date, todayStr))
        
        console.log(`[NOTIFICATION] Work started notification sent at ${timeStr}`)
      }
    } catch (notificationError) {
      // Don't fail the completion if notification fails
      console.error('[NOTIFICATION] Work started notification failed:', notificationError)
    }

    // ============================================
    // END NOTIFICATION LOGIC
    // ============================================

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to complete move:", error)
    return NextResponse.json({ error: "Failed to complete move" }, { status: 500 })
  }
}
