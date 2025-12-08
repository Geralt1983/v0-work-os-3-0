import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const allMoves = await db.select().from(moves)

    const metrics = allClients.map((client) => {
      const clientMoves = allMoves.filter((m) => m.clientId === client.id)
      const completedMoves = clientMoves.filter((m) => m.status === "done")
      const activeMoves = clientMoves.filter((m) => m.status !== "done")

      const lastCompleted = completedMoves.sort(
        (a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0),
      )[0]

      const daysSinceLastMove = lastCompleted?.completedAt
        ? Math.floor((Date.now() - lastCompleted.completedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        clientId: client.id,
        clientName: client.name,
        totalMoves: clientMoves.length,
        completedMoves: completedMoves.length,
        activeMoves: activeMoves.length,
        daysSinceLastMove,
        isStale: daysSinceLastMove !== null && daysSinceLastMove > 2,
      }
    })

    return NextResponse.json(metrics)
  } catch (error) {
    console.error("Failed to fetch client metrics:", error)
    return NextResponse.json({ error: "Failed to fetch client metrics" }, { status: 500 })
  }
}
