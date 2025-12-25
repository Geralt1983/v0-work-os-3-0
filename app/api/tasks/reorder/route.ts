import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq } from "drizzle-orm"

// POST reorder moves
export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { status, orderedIds } = body

    if (!status || !Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "status and orderedIds array are required" }, { status: 400 })
    }

    // Update sortOrder for each move
    const updates = orderedIds.map((id: number, index: number) =>
      db.update(moves).set({ sortOrder: index, updatedAt: new Date() }).where(eq(moves.id, id)),
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true, reordered: orderedIds.length })
  } catch (error) {
    console.error("Failed to reorder moves:", error)
    return NextResponse.json({ error: "Failed to reorder moves" }, { status: 500 })
  }
}
