import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, desc, gte, and } from "drizzle-orm"

interface CompletedMove {
  id: number
  title: string
  completedAt: Date
  effortActual: number | null
  effortEstimate: number | null
  drainType: string | null
  clientId: number | null
  clientName: string | null
  clientColor: string | null
}

interface DayGroup {
  date: string
  displayLabel: string
  moves: CompletedMove[]
  totalMinutes: number
  uniqueClients: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daysBack = Number.parseInt(searchParams.get("days") || "30")
    const timezone = searchParams.get("timezone") || "America/New_York"

    const db = getDb()

    // Calculate date threshold
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)
    cutoffDate.setHours(0, 0, 0, 0)

    const completedMoves = await db
      .select({
        id: moves.id,
        title: moves.title,
        completedAt: moves.completedAt,
        effortActual: moves.effortActual,
        effortEstimate: moves.effortEstimate,
        drainType: moves.drainType,
        clientId: moves.clientId,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(moves)
      .leftJoin(clients, eq(moves.clientId, clients.id))
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, cutoffDate)))
      .orderBy(desc(moves.completedAt))

    // Group by date in user's timezone
    const grouped = new Map<string, DayGroup>()
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Get today and yesterday keys in user's timezone
    const getTzDateKey = (date: Date) => {
      const localStr = date.toLocaleDateString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      const [month, day, year] = localStr.split("/")
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    }

    const todayKey = getTzDateKey(today)
    const yesterdayKey = getTzDateKey(yesterday)

    for (const move of completedMoves) {
      if (!move.completedAt) continue

      const dateKey = getTzDateKey(new Date(move.completedAt))

      // Determine display label
      let displayLabel: string
      if (dateKey === todayKey) {
        displayLabel = "Today"
      } else if (dateKey === yesterdayKey) {
        displayLabel = "Yesterday"
      } else {
        displayLabel = new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      }

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          date: dateKey,
          displayLabel,
          moves: [],
          totalMinutes: 0,
          uniqueClients: 0,
        })
      }

      const group = grouped.get(dateKey)!
      group.moves.push(move)

      const minutes = (move.effortActual || move.effortEstimate || 1) * 20
      group.totalMinutes += minutes
    }

    // Calculate unique clients per day
    for (const group of grouped.values()) {
      const clientNames = new Set(group.moves.map((m) => m.clientName).filter(Boolean))
      group.uniqueClients = clientNames.size
    }

    // Convert to array and sort by date descending
    const result = Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({
      days: result,
      timezone,
      totalDays: result.length,
    })
  } catch (error) {
    console.error("Failed to get completion history:", error)
    return NextResponse.json({ error: "Failed to get completion history" }, { status: 500 })
  }
}
