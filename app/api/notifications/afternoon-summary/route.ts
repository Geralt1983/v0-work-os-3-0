export const maxDuration = 60

import { NextResponse } from "next/server"
import { sendNotification, formatAfternoonSummary } from "@/lib/notifications"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, gte, and, ne } from "drizzle-orm"
import { DAILY_TARGET_MINUTES } from "@/lib/constants"

export async function GET() {
  console.log("[Afternoon Summary] Starting")

  try {
    const db = getDb()

    const now = new Date()
    const estOffset = -5 * 60
    const utcOffset = now.getTimezoneOffset()
    const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000)

    const todayStr = estTime.toISOString().split("T")[0]
    const todayStart = new Date(`${todayStr}T00:00:00-05:00`)

    console.log("[Afternoon Summary] Today start:", todayStart.toISOString())

    const todayMoves = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, todayStart)))
      .limit(maxDuration)

    const todayMinutes = todayMoves.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)

    const clientIds = [...new Set(todayMoves.map((m) => m.clientId).filter(Boolean))]
    const clientsTouched: string[] = []

    for (const id of clientIds) {
      const [client] = await db.select().from(clients).where(eq(clients.id, id!))
      if (client) clientsTouched.push(client.name)
    }

    const activeMoves = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "active"), ne(moves.status, "done")))
      .limit(maxDuration)

    const message = formatAfternoonSummary({
      todayMoves: todayMoves.length,
      todayMinutes,
      targetMinutes: DAILY_TARGET_MINUTES,
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
