import { NextResponse } from "next/server"
import { sendNotification, formatAfternoonSummary } from "@/lib/notifications"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, gte, and, ne } from "drizzle-orm"

export async function GET() {
  console.log("[Afternoon Summary] Starting")

  try {
    const db = getDb()

    // Get start of today in EST
    const now = new Date()
    const estOffset = -5 * 60
    const utcOffset = now.getTimezoneOffset()
    const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)

    const todayStr = estTime.toISOString().split("T")[0]
    const todayStart = new Date(`${todayStr}T00:00:00-05:00`)

    console.log("[Afternoon Summary] Today start:", todayStart.toISOString())

    // Get today's completed moves
    const todayMoves = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, todayStart)))

    const todayMinutes = todayMoves.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)

    // Get unique clients touched today
    const clientIds = [...new Set(todayMoves.map((m) => m.clientId).filter(Boolean))]
    const clientsTouched: string[] = []

    for (const id of clientIds) {
      const [client] = await db.select().from(clients).where(eq(clients.id, id!))
      if (client) clientsTouched.push(client.name)
    }

    // Count remaining active moves
    const activeMoves = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "active"), ne(moves.status, "done")))

    const message = formatAfternoonSummary({
      todayMoves: todayMoves.length,
      todayMinutes,
      targetMinutes: 180,
      clientsTouched,
      remainingActive: activeMoves.length,
    })

    console.log("[Afternoon Summary] Message:", message)

    const result = await sendNotification(message, {
      title: "⏰ Afternoon Check-in",
      tags: "clock4,chart_with_upwards_trend",
      priority: "default",
    })

    return NextResponse.json({ ...result, message })
  } catch (error) {
    console.error("[Afternoon Summary] Error:", error)
    return NextResponse.json({ error: "Failed to send afternoon summary", details: String(error) }, { status: 500 })
  }
}
