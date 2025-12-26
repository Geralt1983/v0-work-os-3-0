import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks } from "@/lib/schema"
import { eq } from "drizzle-orm"

// POST reorder tasks
export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { status, orderedIds } = body

    if (!status || !Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "status and orderedIds array are required" }, { status: 400 })
    }

    // Update sortOrder for each task
    const updates = orderedIds.map((id: number, index: number) =>
      db.update(tasks).set({ sortOrder: index, updatedAt: new Date() }).where(eq(tasks.id, id)),
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true, reordered: orderedIds.length })
  } catch (error) {
    console.error("Failed to reorder tasks:", error)
    return NextResponse.json({ error: "Failed to reorder tasks" }, { status: 500 })
  }
}
