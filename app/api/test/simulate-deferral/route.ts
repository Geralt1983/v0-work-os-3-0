import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, taskEvents, clientMemory, clients } from "@/lib/schema"
import { eq, sql, desc } from "drizzle-orm"

// POST - Simulate a deferral event for testing
export async function POST(request: NextRequest) {
  try {
    const db = await getDb()
    const { taskId } = await request.json()

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 })
    }

    // Get the task and its client
    const [task] = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        clientId: tasks.clientId,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Log a demoted event
    await db.insert(taskEvents).values({
      taskId,
      eventType: "demoted",
      fromStatus: task.status || "active",
      toStatus: "backlog",
      metadata: { simulated: true },
    })

    // Get client name and update defer count
    if (task.clientId) {
      const [client] = await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, task.clientId))
        .limit(1)

      if (client) {
        await db
          .update(clientMemory)
          .set({
            avoidanceScore: sql`COALESCE(avoidance_score, 0) + 1`,
            updatedAt: new Date(),
          })
          .where(eq(clientMemory.clientName, client.name))
      }
    }

    // Get total deferral count for this task
    const events = await db
      .select()
      .from(taskEvents)
      .where(eq(taskEvents.taskId, taskId))
      .orderBy(desc(taskEvents.createdAt))

    const deferralCount = events.filter((e) => e.eventType === "demoted" || e.eventType === "deferred").length

    return NextResponse.json({
      success: true,
      taskId,
      title: task.title,
      deferralCount,
      message: `Simulated deferral for "${task.title}". Total deferrals: ${deferralCount}`,
    })
  } catch (error) {
    console.error("Failed to simulate deferral:", error)
    return NextResponse.json({ error: "Failed to simulate deferral" }, { status: 500 })
  }
}

// GET - List all task events for debugging
export async function GET() {
  try {
    const db = await getDb()

    const events = await db
      .select({
        id: taskEvents.id,
        taskId: taskEvents.taskId,
        eventType: taskEvents.eventType,
        fromStatus: taskEvents.fromStatus,
        toStatus: taskEvents.toStatus,
        metadata: taskEvents.metadata,
        createdAt: taskEvents.createdAt,
        taskTitle: tasks.title,
        clientName: clients.name,
      })
      .from(taskEvents)
      .leftJoin(tasks, eq(taskEvents.taskId, tasks.id))
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .orderBy(desc(taskEvents.createdAt))
      .limit(50)

    return NextResponse.json({ events })
  } catch (error) {
    console.error("Failed to fetch events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}
