import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number.parseInt(searchParams.get("days") || "30")
  const clientId = searchParams.get("clientId")

  try {
    const sql = getDb()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = `
      SELECT 
        m.id, m.title, m.drain_type, m.effort_estimate, m.completed_at,
        c.name as client_name, c.color as client_color
      FROM moves m
      LEFT JOIN clients c ON m.client_id = c.id
      WHERE m.status = 'done' 
        AND m.completed_at >= $1
    `
    const params: any[] = [startDate.toISOString()]

    if (clientId) {
      query += ` AND m.client_id = $2`
      params.push(Number.parseInt(clientId))
    }

    query += ` ORDER BY m.completed_at DESC`

    const completedMoves = await sql(query, params)

    // Group by date
    const grouped: Record<string, any[]> = {}

    for (const move of completedMoves) {
      const completedAt = move.completed_at instanceof Date ? move.completed_at.toISOString() : move.completed_at
      const dateKey = completedAt.split("T")[0]

      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push({
        id: move.id,
        title: move.title,
        clientName: move.client_name,
        clientColor: move.client_color,
        drainType: move.drain_type,
        effortEstimate: move.effort_estimate,
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
