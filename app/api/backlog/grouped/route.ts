import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients, clientMemory } from "@/lib/schema"
import { eq, asc, and, gte } from "drizzle-orm"

interface BacklogTask {
  id: number
  title: string
  drainType: string | null
  effortEstimate: number | null
  daysInBacklog: number
  decayStatus: "normal" | "aging" | "stale" | "critical"
}

interface ClientGroup {
  clientId: number
  clientName: string
  clientColor: string
  staleDays: number
  touchedToday: boolean
  tasks: BacklogTask[]
}

export async function GET() {
  try {
    const db = getDb()

    // Get all backlog moves grouped by client
    const backlogMoves = await db
      .select({
        id: moves.id,
        title: moves.title,
        clientId: moves.clientId,
        drainType: moves.drainType,
        effortEstimate: moves.effortEstimate,
        createdAt: moves.createdAt,
        sortOrder: moves.sortOrder,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(moves)
      .leftJoin(clients, eq(moves.clientId, clients.id))
      .where(eq(moves.status, "backlog"))
      .orderBy(asc(moves.sortOrder))

    // Get client memory for stale days
    const memories = await db.select().from(clientMemory)
    const memoryMap = new Map(memories.map((m) => [m.clientName, m]))

    // Check what was touched today (EST)
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60000)
    const todayStart = new Date(estNow)
    todayStart.setHours(0, 0, 0, 0)

    const todayMoves = await db
      .select({
        clientName: clients.name,
      })
      .from(moves)
      .leftJoin(clients, eq(moves.clientId, clients.id))
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, todayStart)))

    const touchedToday = new Set(todayMoves.map((m) => m.clientName))

    // Group by client
    const grouped = new Map<number, ClientGroup>()

    for (const move of backlogMoves) {
      if (!move.clientId) continue

      const clientId = move.clientId

      if (!grouped.has(clientId)) {
        const memory = memoryMap.get(move.clientName || "")
        grouped.set(clientId, {
          clientId,
          clientName: move.clientName || "Unknown",
          clientColor: move.clientColor || "#6b7280",
          staleDays: memory?.staleDays || 0,
          touchedToday: touchedToday.has(move.clientName),
          tasks: [],
        })
      }

      const daysInBacklog = Math.floor((Date.now() - new Date(move.createdAt).getTime()) / (1000 * 60 * 60 * 24))

      let decayStatus: BacklogTask["decayStatus"] = "normal"
      if (daysInBacklog >= 21) decayStatus = "critical"
      else if (daysInBacklog >= 14) decayStatus = "stale"
      else if (daysInBacklog >= 7) decayStatus = "aging"

      grouped.get(clientId)!.tasks.push({
        id: move.id,
        title: move.title,
        drainType: move.drainType,
        effortEstimate: move.effortEstimate,
        daysInBacklog,
        decayStatus,
      })
    }

    // Convert to array and sort by stale days (most stale first)
    const result = Array.from(grouped.values()).sort((a, b) => {
      // Touched today goes last
      if (a.touchedToday && !b.touchedToday) return 1
      if (!a.touchedToday && b.touchedToday) return -1
      // Then by stale days
      return b.staleDays - a.staleDays
    })

    return NextResponse.json({
      groups: result,
      totalTasks: backlogMoves.length,
    })
  } catch (error) {
    console.error("Failed to get grouped backlog:", error)
    return NextResponse.json({ error: "Failed to get grouped backlog" }, { status: 500 })
  }
}
