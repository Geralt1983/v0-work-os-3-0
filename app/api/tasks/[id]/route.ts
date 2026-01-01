import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { logTaskEvent, determineEventType } from "@/lib/events"

// GET single task
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const [task] = await db
      .select({
        id: tasks.id,
        clientId: tasks.clientId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        valueTier: tasks.valueTier,
        effortEstimate: tasks.effortEstimate,
        effortActual: tasks.effortActual,
        drainType: tasks.drainType,
        sortOrder: tasks.sortOrder,
        subtasks: tasks.subtasks,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
        clientName: clients.name,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(eq(tasks.id, Number.parseInt(id, 10)))

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error("Failed to fetch task:", error)
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 })
  }
}

// PATCH update task
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const taskId = Number.parseInt(id, 10)
    const body = await request.json()

    const [currentTask] = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, taskId)).limit(1)

    const updateData = {
      ...body,
      updatedAt: new Date(),
    }

    const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, taskId)).returning()

    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (body.status && currentTask && body.status !== currentTask.status) {
      const eventType = determineEventType(currentTask.status, body.status)
      await logTaskEvent({
        taskId,
        eventType,
        fromStatus: currentTask.status,
        toStatus: body.status,
      })
    } else if (body.title || body.description || body.valueTier || body.drainType) {
      // Log edit event for non-status changes
      await logTaskEvent({
        taskId,
        eventType: "edited",
        metadata: { fields: Object.keys(body) },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update task:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

// DELETE task
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const [deleted] = await db
      .delete(tasks)
      .where(eq(tasks.id, Number.parseInt(id, 10)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete task:", error)
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
