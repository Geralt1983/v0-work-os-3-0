import { getDb } from "./db"
import { moveEvents, clientMemory, moves, clients } from "./schema"
import { eq, sql } from "drizzle-orm"

export type EventType = "created" | "promoted" | "demoted" | "completed" | "deferred" | "reopened" | "edited"

interface LogEventParams {
  moveId: number
  eventType: EventType
  fromStatus?: string
  toStatus?: string
  metadata?: Record<string, any>
}

export async function logMoveEvent({ moveId, eventType, fromStatus, toStatus, metadata = {} }: LogEventParams) {
  try {
    const db = await getDb()

    // Log the event
    await db.insert(moveEvents).values({
      moveId,
      eventType,
      fromStatus,
      toStatus,
      metadata,
    })

    // Get the move to find its client
    const [move] = await db
      .select({
        id: moves.id,
        clientId: moves.clientId,
      })
      .from(moves)
      .where(eq(moves.id, moveId))
      .limit(1)

    if (!move?.clientId) return

    // Get the client name
    const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, move.clientId)).limit(1)

    if (!client) return

    // If this is a deferral, increment the defer count for the client
    if (eventType === "deferred" || eventType === "demoted") {
      await db
        .update(clientMemory)
        .set({
          deferCount: sql`COALESCE(defer_count, 0) + 1`,
          updatedAt: new Date(),
        })
        .where(eq(clientMemory.clientName, client.name))
    }

    // If completed, update client memory
    if (eventType === "completed") {
      await db
        .update(clientMemory)
        .set({
          lastMoveAt: new Date(),
          totalMoves: sql`COALESCE(total_moves, 0) + 1`,
          staleDays: 0,
          updatedAt: new Date(),
        })
        .where(eq(clientMemory.clientName, client.name))
    }
  } catch (err) {
    console.error("[events] Failed to log move event:", err)
  }
}

// Get event history for a move
export async function getMoveHistory(moveId: number) {
  try {
    const db = await getDb()
    return db.select().from(moveEvents).where(eq(moveEvents.moveId, moveId)).orderBy(moveEvents.createdAt)
  } catch (err) {
    console.error("[events] Failed to get move history:", err)
    return []
  }
}

// Count deferrals for a specific move
export async function getDeferralCount(moveId: number): Promise<number> {
  try {
    const db = await getDb()
    const events = await db.select().from(moveEvents).where(eq(moveEvents.moveId, moveId))

    return events.filter((e) => e.eventType === "deferred" || e.eventType === "demoted").length
  } catch (err) {
    console.error("[events] Failed to get deferral count:", err)
    return 0
  }
}

// Determine event type from status change
export function determineEventType(fromStatus: string | undefined, toStatus: string): EventType {
  if (!fromStatus) return "created"
  if (toStatus === "done") return "completed"
  if (fromStatus === "done") return "reopened"

  const statusPriority: Record<string, number> = {
    active: 4,
    queued: 3,
    backlog: 2,
    done: 1,
  }

  const fromPriority = statusPriority[fromStatus] ?? 0
  const toPriority = statusPriority[toStatus] ?? 0

  if (toPriority > fromPriority) return "promoted"
  if (toPriority < fromPriority) return "demoted"
  return "edited"
}
