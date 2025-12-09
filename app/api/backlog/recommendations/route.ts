import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients, clientMemory } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"

interface ScoredMove {
  id: number
  title: string
  clientId: number | null
  clientName: string | null
  clientColor: string | null
  drainType: string | null
  effortEstimate: number | null
  createdAt: Date
  score: number
  reason: string
  daysInBacklog: number
}

function getPreferredDrainTypes(hour: number): string[] {
  if (hour < 11) return ["deep", "creative"]
  if (hour < 14) return ["comms", "admin"]
  return ["easy", "admin", "comms"]
}

export async function GET() {
  try {
    const db = getDb()

    // Get all backlog moves with client info
    const backlogMoves = await db
      .select({
        id: moves.id,
        title: moves.title,
        clientId: moves.clientId,
        drainType: moves.drainType,
        effortEstimate: moves.effortEstimate,
        createdAt: moves.createdAt,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(moves)
      .leftJoin(clients, eq(moves.clientId, clients.id))
      .where(eq(moves.status, "backlog"))

    // Get client memory for stale days
    const memories = await db.select().from(clientMemory)
    const staleMap = new Map(memories.map((m) => [m.clientName, m.staleDays || 0]))

    // Get clients touched today (EST)
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

    // Current hour for energy matching (EST)
    const hour = estNow.getHours()
    const preferredDrainTypes = getPreferredDrainTypes(hour)

    // Score each move
    const scored: ScoredMove[] = backlogMoves.map((move) => {
      const clientName = move.clientName || "Unknown"
      const staleDays = staleMap.get(clientName) || 0
      const daysInBacklog = Math.floor((Date.now() - new Date(move.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      const energyMatch = preferredDrainTypes.includes(move.drainType || "")
      const alreadyTouched = touchedToday.has(clientName)

      let score = 0
      const reasons: string[] = []

      // Stale client boost
      if (staleDays >= 2) {
        score += staleDays * 15
        reasons.push(`${clientName} is ${staleDays} days stale`)
      }

      // Age in backlog
      if (daysInBacklog >= 7) {
        score += daysInBacklog * 2
        reasons.push(`${daysInBacklog} days in backlog`)
      }

      // Energy match
      if (energyMatch) {
        score += 10
        reasons.push(`${move.drainType} work fits current time`)
      }

      // Quick win boost
      if (move.effortEstimate === 1) {
        score += 5
        reasons.push("Quick win")
      }

      // Penalty if client already touched
      if (alreadyTouched) {
        score -= 20
      }

      return {
        id: move.id,
        title: move.title,
        clientId: move.clientId,
        clientName: move.clientName,
        clientColor: move.clientColor,
        drainType: move.drainType,
        effortEstimate: move.effortEstimate,
        createdAt: move.createdAt,
        score,
        reason: reasons.length > 0 ? reasons.join(", ") : "Good next candidate",
        daysInBacklog,
      }
    })

    // Sort by score, take top 3, ensure client diversity
    const sorted = scored.sort((a, b) => b.score - a.score)
    const recommendations: ScoredMove[] = []
    const usedClients = new Set<string>()

    for (const item of sorted) {
      if (recommendations.length >= 3) break

      const clientName = item.clientName
      // Allow max 1 from same client in recommendations
      if (clientName && usedClients.has(clientName)) {
        continue
      }

      recommendations.push(item)
      if (clientName) usedClients.add(clientName)
    }

    return NextResponse.json({
      recommendations: recommendations.map((r) => ({
        id: r.id,
        title: r.title,
        clientName: r.clientName,
        clientColor: r.clientColor,
        drainType: r.drainType,
        effortEstimate: r.effortEstimate,
        reason: r.reason,
        score: r.score,
        daysInBacklog: r.daysInBacklog,
      })),
    })
  } catch (error) {
    console.error("Failed to get recommendations:", error)
    return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 })
  }
}
