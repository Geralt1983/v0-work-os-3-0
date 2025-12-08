import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq } from "drizzle-orm"

// POST mark move as complete
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const [updated] = await db
      .update(moves)
      .set({
        status: "done",
        completedAt: new Date(),
        effortActual: body.effortActual || null,
        updatedAt: new Date(),
      })
      .where(eq(moves.id, Number.parseInt(id)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to complete move:", error)
    return NextResponse.json({ error: "Failed to complete move" }, { status: 500 })
  }
}
