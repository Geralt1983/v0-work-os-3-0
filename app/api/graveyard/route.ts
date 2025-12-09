import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moveGraveyard, clients } from "@/lib/schema"
import { desc, eq } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()

    const archived = await db
      .select({
        id: moveGraveyard.id,
        originalMoveId: moveGraveyard.originalMoveId,
        title: moveGraveyard.title,
        description: moveGraveyard.description,
        effortEstimate: moveGraveyard.effortEstimate,
        drainType: moveGraveyard.drainType,
        archivedAt: moveGraveyard.archivedAt,
        archiveReason: moveGraveyard.archiveReason,
        daysInBacklog: moveGraveyard.daysInBacklog,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(moveGraveyard)
      .leftJoin(clients, eq(moveGraveyard.clientId, clients.id))
      .orderBy(desc(moveGraveyard.archivedAt))

    return NextResponse.json(archived)
  } catch (error) {
    console.error("Failed to fetch graveyard:", error)
    return NextResponse.json({ error: "Failed to fetch graveyard" }, { status: 500 })
  }
}
