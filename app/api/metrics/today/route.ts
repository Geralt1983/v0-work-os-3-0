import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"

function calculateMomentum(completedMoves: any[]): { score: number; trend: "rising" | "falling" | "steady" } {
  if (completedMoves.length === 0) return { score: 0, trend: "steady" }

  // Sort by completion time - ensure dates are parsed correctly
  const sorted = [...completedMoves]
    .filter((m) => m.completedAt) // Only moves with completion timestamps
    .sort((a, b) => {
      const aTime = new Date(a.completedAt).getTime()
      const bTime = new Date(b.completedAt).getTime()
      return aTime - bTime
    })

  if (sorted.length < 2) return { score: 50, trend: "steady" }

  // Calculate time gaps between completions
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].completedAt).getTime()
    const currTime = new Date(sorted[i].completedAt).getTime()
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

    const now = new Date()
    // Convert to EST (UTC-5) or EDT (UTC-4)
    const estOffset = -5 * 60 // EST offset in minutes
    const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60 * 1000)

    // Get start of today in EST
    const todayEST = new Date(estNow)
    todayEST.setHours(0, 0, 0, 0)

    // Convert back to UTC for database query
    const todayUTC = new Date(todayEST.getTime() - (now.getTimezoneOffset() + estOffset) * 60 * 1000)

    console.log("[v0] Metrics API: Querying for moves completed since", todayUTC.toISOString())

    const completedToday = await db
      .select()
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, todayUTC)))

    console.log("[v0] Metrics API: Found", completedToday.length, "completed moves today")
    console.log(
      "[v0] Metrics API: Completed moves:",
      completedToday.map((m) => ({
        id: m.id,
        title: m.title,
        completedAt: m.completedAt,
        effortEstimate: m.effortEstimate,
      })),
    )

    const earnedMinutes = completedToday.reduce((sum, m) => {
      const effort = m.effortEstimate || 2
      return sum + effort * 20
    }, 0)

    const targetMinutes = 180
    const percent = Math.round((earnedMinutes / targetMinutes) * 100)

    const momentum = calculateMomentum(completedToday)

    console.log("[v0] Metrics API: Calculated momentum", momentum)

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
