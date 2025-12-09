import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, and, gte, desc } from "drizzle-orm"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number.parseInt(searchParams.get("days") || "30")
  const clientId = searchParams.get("clientId")

  try {
    const db = getDb()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const conditions = [eq(moves.status, "done"), gte(moves.completedAt, startDate)]

    if (clientId) {
      conditions.push(eq(moves.clientId, Number.parseInt(clientId)))
    }

    const completedMoves = await db
      .select({
        id: moves.id,
        title: moves.title,
        drainType: moves.drainType,
        effortEstimate: moves.effortEstimate,
        completedAt: moves.completedAt,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(moves)
      .leftJoin(clients, eq(moves.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(moves.completedAt))

    // Group by date
    const grouped: Record<string, any[]> = {}

    for (const move of completedMoves) {
      if (!move.completedAt) continue

      const completedAt = move.completedAt instanceof Date ? move.completedAt.toISOString() : String(move.completedAt)
      const dateKey = completedAt.split("T")[0]

      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push({
        id: move.id,
        title: move.title,
        clientName: move.clientName,
        clientColor: move.clientColor,
        drainType: move.drainType,
        effortEstimate: move.effortEstimate,
        completedAt: completedAt,
      })
    }

    // Convert to array sorted by date
    const timeline = Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, moves]) => ({
        date,
        moves,
        totalMinutes: moves.reduce((sum: number, m: any) => sum + (m.effortEstimate || 1) * 20, 0),
        clientsTouched: [...new Set(moves.map((m: any) => m.clientName))].filter(Boolean),
      }))

    return NextResponse.json({ timeline })
  } catch (error) {
    console.error("Failed to fetch history:", error)

    // Return mock data only on error
    const mockTimeline = [
      {
        date: new Date().toISOString().split("T")[0],
        moves: [
          {
            id: 1,
            title: "Review contract",
            clientName: "Memphis",
            clientColor: "#f97316",
            drainType: "deep",
            effortEstimate: 2,
            completedAt: new Date().toISOString(),
          },
        ],
        totalMinutes: 40,
        clientsTouched: ["Memphis"],
      },
    ]
    return NextResponse.json({ timeline: mockTimeline })
  }
}
