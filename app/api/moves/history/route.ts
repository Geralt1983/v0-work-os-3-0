import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { isPreviewEnvironment } from "@/lib/mock-data"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number.parseInt(searchParams.get("days") || "30")
  const clientId = searchParams.get("clientId")

  // Return mock data in preview
  if (isPreviewEnvironment()) {
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
          {
            id: 2,
            title: "Send status update",
            clientName: "Raleigh",
            clientColor: "#8b5cf6",
            drainType: "comms",
            effortEstimate: 1,
            completedAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
        totalMinutes: 60,
        clientsTouched: ["Memphis", "Raleigh"],
      },
      {
        date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
        moves: [
          {
            id: 3,
            title: "Draft proposal",
            clientName: "Kentucky",
            clientColor: "#10b981",
            drainType: "creative",
            effortEstimate: 3,
            completedAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
        totalMinutes: 60,
        clientsTouched: ["Kentucky"],
      },
    ]
    return NextResponse.json({ timeline: mockTimeline })
  }

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
      const dateKey = new Date(move.completed_at).toISOString().split("T")[0]
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
        completedAt: move.completed_at,
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
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}
