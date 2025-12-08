import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"

function calculateMomentum(completedMoves: any[]): { score: number; trend: "rising" | "falling" | "steady" } {
  if (completedMoves.length === 0) return { score: 0, trend: "steady" }

  // Sort by completion time
  const sorted = [...completedMoves].sort((a, b) => (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0))

  // Calculate time gaps between completions
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prevTime = sorted[i - 1].completedAt?.getTime() || 0
    const currTime = sorted[i].completedAt?.getTime() || 0
    if (prevTime && currTime) {
      gaps.push((currTime - prevTime) / (1000 * 60)) // Gap in minutes
    }
  }

  if (gaps.length === 0) return { score: 50, trend: "steady" }

  // Average gap (lower is better momentum)
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length

  // Score: 100 = completing every 10 min, 0 = completing every 120+ min
  const score = Math.max(0, Math.min(100, Math.round(100 - (avgGap / 120) * 100)))

  // Trend: compare first half gaps to second half
  const midpoint = Math.floor(gaps.length / 2)
  if (midpoint > 0) {
    const firstHalf = gaps.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint
    const secondHalf = gaps.slice(midpoint).reduce((a, b) => a + b, 0) / (gaps.length - midpoint)

    if (secondHalf < firstHalf * 0.8) return { score, trend: "rising" }
    if (secondHalf > firstHalf * 1.2) return { score, trend: "falling" }
  }

  return { score, trend: "steady" }
}

export async function GET() {
  try {
    const db = getDb()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, today)))

    const earnedMinutes = completedToday.reduce((sum, m) => {
      const effort = m.effortEstimate || 2
      return sum + effort * 20
    }, 0)

    const targetMinutes = 180
    const percent = Math.round((earnedMinutes / targetMinutes) * 100)

    const momentum = calculateMomentum(completedToday)

    // Calculate streak (consecutive days hitting target)
    // For now, we'll just return basic streak info
    const streak = 0 // TODO: Implement from daily_log table

    return NextResponse.json({
      completedCount: completedToday.length,
      earnedMinutes,
      targetMinutes,
      percent,
      paceStatus: percent >= 100 ? "on_track" : "behind",
      momentum,
      streak,
    })
  } catch (error) {
    console.error("Failed to fetch metrics:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
