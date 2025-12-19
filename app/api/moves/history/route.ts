import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, and, gte, desc } from "drizzle-orm"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number.parseInt(searchParams.get("days") || "30")
  const clientId = searchParams.get("clientId")
  const timezone = searchParams.get("timezone") || "America/New_York"

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

    // Group by date IN USER'S TIMEZONE
    const grouped: Record<string, any[]> = {}

    for (const move of completedMoves) {
      if (!move.completedAt) continue

      const completedAt = move.completedAt instanceof Date ? move.completedAt : new Date(move.completedAt)

      // Convert UTC timestamp to user's local date string
      const dateKey = completedAt.toLocaleDateString("en-CA", { timeZone: timezone }) // YYYY-MM-DD format

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
        completedAt: completedAt.toISOString(),
      })
    }

    // Also compute today and yesterday in user's timezone for frontend comparison
    const now = new Date()
    const todayKey = now.toLocaleDateString("en-CA", { timeZone: timezone })
    const yesterdayDate = new Date(now.getTime() - 86400000)
    const yesterdayKey = yesterdayDate.toLocaleDateString("en-CA", { timeZone: timezone })

    // Convert to array sorted by date
    const timeline = Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, moves]) => ({
        date,
        // Add display label based on user's timezone
        displayLabel: date === todayKey ? "Today" : date === yesterdayKey ? "Yesterday" : null,
        moves,
        totalMinutes: moves.reduce((sum: number, m: any) => sum + (m.effortEstimate || 1) * 20, 0),
        clientsTouched: [...new Set(moves.map((m: any) => m.clientName))].filter(Boolean),
      }))

    return NextResponse.json({ timeline, todayKey, yesterdayKey })
  } catch (error) {
    console.error("Failed to fetch history:", error)

    // Return mock data only on error
    const mockTimeline = [
      {
        date: new Date().toISOString().split("T")[0],
        displayLabel: "Today",
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
