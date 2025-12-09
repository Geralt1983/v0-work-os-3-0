import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { isPreviewEnvironment } from "@/lib/mock-data"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const weeks = Number.parseInt(searchParams.get("weeks") || "12")

  // Return mock data in preview
  if (isPreviewEnvironment()) {
    const mockHeatmap = []
    for (let i = weeks * 7; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      // Random activity levels
      const level = Math.random() > 0.3 ? Math.floor(Math.random() * 5) : 0
      const minutes = level * 45
      mockHeatmap.push({
        date: dateStr,
        count: level > 0 ? Math.ceil(level * 1.5) : 0,
        minutes,
        level,
      })
    }
    return NextResponse.json({ heatmap: mockHeatmap })
  }

  try {
    const sql = getDb()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - weeks * 7)

    const dailyCounts = await sql`
      SELECT 
        DATE(completed_at) as date,
        COUNT(*)::int as count,
        SUM(COALESCE(effort_estimate, 1) * 20)::int as minutes
      FROM moves
      WHERE status = 'done' AND completed_at >= ${startDate.toISOString()}
      GROUP BY DATE(completed_at)
      ORDER BY DATE(completed_at)
    `

    // Build full calendar grid
    const heatmapData: { date: string; count: number; minutes: number; level: number }[] = []
    const countMap = new Map(dailyCounts.map((d: any) => [d.date, d]))

    for (let i = weeks * 7; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      const data = countMap.get(dateStr) as any

      const minutes = data?.minutes || 0
      // Level 0-4 based on percentage of goal (180 min)
      let level = 0
      if (minutes > 0) {
        const percentage = minutes / 180
        if (percentage >= 1) level = 4
        else if (percentage >= 0.75) level = 3
        else if (percentage >= 0.5) level = 2
        else level = 1
      }

      heatmapData.push({
        date: dateStr,
        count: data?.count || 0,
        minutes,
        level,
      })
    }

    return NextResponse.json({ heatmap: heatmapData })
  } catch (error) {
    console.error("Failed to fetch heatmap:", error)
    return NextResponse.json({ error: "Failed to fetch heatmap" }, { status: 500 })
  }
}
