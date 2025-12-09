import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { logMoveEvent } from "@/lib/events"

// POST mark move as complete
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const moveId = Number.parseInt(id)
    const body = await request.json().catch(() => ({}))

    const [currentMove] = await db.select({ status: moves.status }).from(moves).where(eq(moves.id, moveId)).limit(1)

    const [updated] = await db
      .update(moves)
      .set({
        status: "done",
        completedAt: new Date(),
        effortActual: body.effortActual || null,
        updatedAt: new Date(),
      })
      .where(eq(moves.id, moveId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 })
    }

    await logMoveEvent({
      moveId,
      eventType: "completed",
      fromStatus: currentMove?.status,
      toStatus: "done",
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to complete move:", error)
    return NextResponse.json({ error: "Failed to complete move" }, { status: 500 })
  }
}
