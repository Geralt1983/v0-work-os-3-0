import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq } from "drizzle-orm"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const weeks = Number.parseInt(searchParams.get("weeks") || "12")

  try {
    const db = getDb()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - weeks * 7)

    const completedMoves = await db
      .select({
        completedAt: moves.completedAt,
        effortEstimate: moves.effortEstimate,
      })
      .from(moves)
      .where(eq(moves.status, "done"))

    // Group by date in JavaScript
    const countMap = new Map<string, { count: number; minutes: number }>()

    for (const move of completedMoves) {
      if (!move.completedAt) continue

      const completedAt = move.completedAt instanceof Date ? move.completedAt.toISOString() : String(move.completedAt)
      const dateKey = completedAt.split("T")[0]

      // Only include dates within range
      if (new Date(dateKey) < startDate) continue

      const existing = countMap.get(dateKey) || { count: 0, minutes: 0 }
      countMap.set(dateKey, {
        count: existing.count + 1,
        minutes: existing.minutes + (move.effortEstimate || 1) * 20,
      })
    }

    // Build full calendar grid
    const heatmapData: { date: string; count: number; minutes: number; level: number }[] = []

    for (let i = weeks * 7; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      const data = countMap.get(dateStr)

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

    const mockHeatmap = []
    for (let i = weeks * 7; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
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
}
