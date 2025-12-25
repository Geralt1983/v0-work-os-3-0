import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { taskGraveyard, clients } from "@/lib/schema"
import { desc, eq } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()

    const archived = await db
      .select({
        id: taskGraveyard.id,
        originalTaskId: taskGraveyard.originalTaskId,
        title: taskGraveyard.title,
        description: taskGraveyard.description,
        effortEstimate: taskGraveyard.effortEstimate,
        drainType: taskGraveyard.drainType,
        archivedAt: taskGraveyard.archivedAt,
        archiveReason: taskGraveyard.archiveReason,
        daysInBacklog: taskGraveyard.daysInBacklog,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(taskGraveyard)
      .leftJoin(clients, eq(taskGraveyard.clientId, clients.id))
      .orderBy(desc(taskGraveyard.archivedAt))

    return NextResponse.json(archived)
  } catch (error) {
    console.error("Failed to fetch graveyard:", error)
    return NextResponse.json({ error: "Failed to fetch graveyard" }, { status: 500 })
  }
}
