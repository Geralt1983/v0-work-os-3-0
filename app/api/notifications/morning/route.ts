import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNtfyNotification } from "@/lib/ntfy"

export async function POST() {
  try {
    const db = getDb()
    const now = new Date()

    // Get start of current week (Monday)
    const startOfWeek = new Date(now)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)

    // Get this week's completed moves
    const weekMoves = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, startOfWeek)))

    const weekEarnedMinutes = weekMoves.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)
    const weekTargetMinutes = 180 * 5 // 5 days
    const weekPercent = Math.round((weekEarnedMinutes / weekTargetMinutes) * 100)

    // Get day of week (1-5 for Mon-Fri)
    const dayOfWeek = now.getDay() || 7 // Convert Sunday (0) to 7
    const workDaysPassed = Math.min(dayOfWeek - 1, 4) // 0-4 work days passed
    const expectedPercent = Math.round((workDaysPassed / 5) * 100)

    // Get active moves count
    const activeMoves = await db.select().from(moves).where(eq(moves.status, "active"))

    const queuedMoves = await db.select().from(moves).where(eq(moves.status, "queued"))

    // Calculate barriers (stale clients - no activity in 3+ days)
    const threeDaysAgo = new Date(now)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const allMoves = await db.select().from(moves)

    const staleClients = allClients.filter((client) => {
      const clientMoves = allMoves.filter((m) => m.clientId === client.id && m.status === "done")
      if (clientMoves.length === 0) return true
      const lastMove = clientMoves.sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      return !lastMove.completedAt || lastMove.completedAt < threeDaysAgo
    })

    // Build status message
    const weekStatus = weekPercent >= expectedPercent ? "on track" : "behind pace"
    const paceEmoji = weekPercent >= expectedPercent ? "white_check_mark" : "warning"

    let message = `Week Progress: ${weekPercent}% (${weekStatus})\n`
    message += `${weekEarnedMinutes} min earned of ${weekTargetMinutes} min weekly target\n\n`
    message += `Today's Setup:\n`
    message += `- ${activeMoves.length} active move(s)\n`
    message += `- ${queuedMoves.length} queued move(s)\n\n`

    if (staleClients.length > 0) {
      message += `Barriers (${staleClients.length} stale clients):\n`
      staleClients.slice(0, 3).forEach((c) => {
        message += `- ${c.name} needs attention\n`
      })
      if (staleClients.length > 3) {
        message += `- ...and ${staleClients.length - 3} more\n`
      }
    } else {
      message += `No barriers - all clients healthy!\n`
    }

    // Recent successes (moves completed in last 2 days)
    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const recentMoves = weekMoves.filter((m) => m.completedAt && m.completedAt >= twoDaysAgo)

    if (recentMoves.length > 0) {
      message += `\nRecent Wins (${recentMoves.length} moves):\n`
      recentMoves.slice(0, 3).forEach((m) => {
        message += `- ${m.title}\n`
      })
    }

    await sendNtfyNotification({
      title: "8AM Status Report",
      message,
      priority: 3,
      tags: [paceEmoji, "sunrise", "workos"],
    })

    return NextResponse.json({
      success: true,
      weekPercent,
      weekStatus,
      staleClients: staleClients.length,
      activeMoves: activeMoves.length,
    })
  } catch (error) {
    console.error("Morning notification error:", error)
    return NextResponse.json({ error: "Failed to send morning notification" }, { status: 500 })
  }
}
