import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, moveEvents, clientMemory, clients } from "@/lib/schema"
import { eq, sql, desc } from "drizzle-orm"

// POST - Simulate a deferral event for testing
export async function POST(request: NextRequest) {
  try {
    const db = await getDb()
    const { moveId } = await request.json()

    if (!moveId) {
      return NextResponse.json({ error: "moveId required" }, { status: 400 })
    }

    // Get the move and its client
    const [move] = await db
      .select({
        id: moves.id,
        title: moves.title,
        status: moves.status,
        clientId: moves.clientId,
      })
      .from(moves)
      .where(eq(moves.id, moveId))
      .limit(1)

    if (!move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 })
    }

    // Log a demoted event
    await db.insert(moveEvents).values({
      moveId,
      eventType: "demoted",
      fromStatus: move.status || "active",
      toStatus: "backlog",
      metadata: { simulated: true },
    })

    // Get client name and update defer count
    if (move.clientId) {
      const [client] = await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, move.clientId))
        .limit(1)

      if (client) {
        await db
          .update(clientMemory)
          .set({
            deferCount: sql`COALESCE(defer_count, 0) + 1`,
            updatedAt: new Date(),
          })
          .where(eq(clientMemory.clientName, client.name))
      }
    }

    // Get total deferral count for this move
    const events = await db
      .select()
      .from(moveEvents)
      .where(eq(moveEvents.moveId, moveId))
      .orderBy(desc(moveEvents.createdAt))

    const deferralCount = events.filter((e) => e.eventType === "demoted" || e.eventType === "deferred").length

    return NextResponse.json({
      success: true,
      moveId,
      title: move.title,
      deferralCount,
      message: `Simulated deferral for "${move.title}". Total deferrals: ${deferralCount}`,
    })
  } catch (error) {
    console.error("Failed to simulate deferral:", error)
    return NextResponse.json({ error: "Failed to simulate deferral" }, { status: 500 })
  }
}

// GET - List all move events for debugging
export async function GET() {
  try {
    const db = await getDb()

    const events = await db
      .select({
        id: moveEvents.id,
        moveId: moveEvents.moveId,
        eventType: moveEvents.eventType,
        fromStatus: moveEvents.fromStatus,
        toStatus: moveEvents.toStatus,
        metadata: moveEvents.metadata,
        createdAt: moveEvents.createdAt,
        moveTitle: moves.title,
        clientName: clients.name,
      })
      .from(moveEvents)
      .leftJoin(moves, eq(moveEvents.moveId, moves.id))
      .leftJoin(clients, eq(moves.clientId, clients.id))
      .orderBy(desc(moveEvents.createdAt))
      .limit(50)

    return NextResponse.json({ events })
  } catch (error) {
    console.error("Failed to fetch events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}
