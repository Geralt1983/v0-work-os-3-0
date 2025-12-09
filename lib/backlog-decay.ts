import { getDb } from "./db"
import { moves, moveGraveyard, clients } from "./schema"
import { eq, and, lte } from "drizzle-orm"

export interface DecayStatus {
  id: number
  title: string
  clientName: string
  daysInBacklog: number
  status: "normal" | "aging" | "stale" | "critical"
}

export async function getBacklogWithDecay(): Promise<DecayStatus[]> {
  const db = getDb()

  const backlogMoves = await db
    .select({
      id: moves.id,
      title: moves.title,
      clientId: moves.clientId,
      createdAt: moves.createdAt,
      clientName: clients.name,
    })
    .from(moves)
    .leftJoin(clients, eq(moves.clientId, clients.id))
    .where(eq(moves.status, "backlog"))

  return backlogMoves.map((move) => {
    const createdAt = move.createdAt
    const daysInBacklog = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))

    let status: DecayStatus["status"] = "normal"
    if (daysInBacklog >= 21) status = "critical"
    else if (daysInBacklog >= 14) status = "stale"
    else if (daysInBacklog >= 7) status = "aging"

    return {
      id: move.id,
      title: move.title,
      clientName: move.clientName || "Unknown",
      daysInBacklog,
      status,
    }
  })
}

export async function archiveMove(moveId: number, reason = "manual") {
  const db = getDb()

  const [move] = await db
    .select({
      id: moves.id,
      clientId: moves.clientId,
      title: moves.title,
      description: moves.description,
      effortEstimate: moves.effortEstimate,
      drainType: moves.drainType,
      createdAt: moves.createdAt,
    })
    .from(moves)
    .where(eq(moves.id, moveId))

  if (!move) throw new Error("Move not found")

  const daysInBacklog = Math.floor((Date.now() - new Date(move.createdAt).getTime()) / (1000 * 60 * 60 * 24))

  // Move to graveyard
  await db.insert(moveGraveyard).values({
    originalMoveId: move.id,
    clientId: move.clientId,
    title: move.title,
    description: move.description,
    effortEstimate: move.effortEstimate,
    drainType: move.drainType,
    archiveReason: reason,
    originalCreatedAt: move.createdAt,
    daysInBacklog,
  })

  // Delete original
  await db.delete(moves).where(eq(moves.id, moveId))

  return { archived: true, daysInBacklog }
}

export async function resurrectMove(graveyardId: number) {
  const db = getDb()

  const [archived] = await db.select().from(moveGraveyard).where(eq(moveGraveyard.id, graveyardId))

  if (!archived) throw new Error("Archived move not found")

  // Recreate move
  const [newMove] = await db
    .insert(moves)
    .values({
      clientId: archived.clientId,
      title: archived.title,
      description: archived.description,
      effortEstimate: archived.effortEstimate,
      drainType: archived.drainType,
      status: "backlog",
    })
    .returning()

  // Remove from graveyard
  await db.delete(moveGraveyard).where(eq(moveGraveyard.id, graveyardId))

  return newMove
}

export async function runAutoDecay() {
  const db = getDb()

  // Find moves that have been in backlog 30+ days
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - 30)

  const expiredMoves = await db
    .select()
    .from(moves)
    .where(and(eq(moves.status, "backlog"), lte(moves.createdAt, threshold)))

  const archived = []
  for (const move of expiredMoves) {
    await archiveMove(move.id, "auto_decay")
    archived.push(move.title)
  }

  return { archivedCount: archived.length, titles: archived }
}

export async function getAgingReport() {
  const decay = await getBacklogWithDecay()

  return {
    aging: decay.filter((d) => d.status === "aging"),
    stale: decay.filter((d) => d.status === "stale"),
    critical: decay.filter((d) => d.status === "critical"),
    totalBacklog: decay.length,
  }
}
