import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks } from "@/lib/schema"
import { eq } from "drizzle-orm"

const statusOrder = ["backlog", "queued", "active"]

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, Number.parseInt(id, 10)))
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const currentIndex = statusOrder.indexOf(task.status)
    if (currentIndex <= 0) {
      return NextResponse.json(task)
    }

    const newStatus = statusOrder[currentIndex - 1]
    const [updated] = await db
      .update(tasks)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, Number.parseInt(id, 10)))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to demote task:", error)
    return NextResponse.json({ error: "Failed to demote task" }, { status: 500 })
  }
}
