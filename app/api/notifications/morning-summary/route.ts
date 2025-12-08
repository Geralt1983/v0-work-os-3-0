import { NextResponse } from "next/server"
import { sendNotification, formatMorningSummary } from "@/lib/notifications"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, gte, and, desc } from "drizzle-orm"

export async function GET() {
  console.log("[Morning Summary] Starting")

  try {
    const db = getDb()

    // Get start of week (Monday) in EST
    const now = new Date()
    const estOffset = -5 * 60
    const utcOffset = now.getTimezoneOffset()
    const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)

    const dayOfWeek = estTime.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(estTime)
    weekStart.setDate(estTime.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    // Convert back to UTC for DB query
    const weekStartUTC = new Date(weekStart.getTime() - (utcOffset + estOffset) * 60 * 1000)

    console.log("[Morning Summary] Week start:", weekStartUTC.toISOString())

    // Get moves completed this week
    const weekMoves = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, weekStartUTC)))

    const weekMinutes = weekMoves.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)
    const daysInWeek = Math.min(dayOfWeek === 0 ? 7 : dayOfWeek, 5)
    const weekTarget = daysInWeek * 180

    console.log("[Morning Summary] Week stats:", { movesCount: weekMoves.length, weekMinutes, weekTarget })

    // Get stale clients (no activity in 2+ days)
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const staleClients: string[] = []

    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    for (const client of allClients) {
      if (client.type === "internal") continue

      const lastMove = await db
        .select()
        .from(moves)
        .where(and(eq(moves.clientId, client.id), eq(moves.status, "done")))
        .orderBy(desc(moves.completedAt))
        .limit(1)

      if (!lastMove[0]?.completedAt || lastMove[0].completedAt < twoDaysAgo) {
        staleClients.push(client.name)
      }
    }

    const message = formatMorningSummary({
      weekMoves: weekMoves.length,
      weekMinutes,
      weekTarget,
      bestDay: null,
      worstDay: null,
      staleClients,
    })

    console.log("[Morning Summary] Message:", message)

    const result = await sendNotification(message, {
      title: "📅 Morning Briefing",
      tags: "sunrise,calendar",
      priority: "default",
    })

    return NextResponse.json({ ...result, message })
  } catch (error) {
    console.error("[Morning Summary] Error:", error)
    return NextResponse.json({ error: "Failed to send morning summary", details: String(error) }, { status: 500 })
  }
}
