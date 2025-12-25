import { getDb } from "./db"
import { taskEvents, clientMemory, tasks, clients } from "./schema"
import { eq, sql } from "drizzle-orm"

export type EventType = "created" | "promoted" | "demoted" | "completed" | "deferred" | "reopened" | "edited"

interface LogEventParams {
  taskId: number
  eventType: EventType
  fromStatus?: string
  toStatus?: string
  metadata?: Record<string, any>
}

export async function logTaskEvent({ taskId, eventType, fromStatus, toStatus, metadata = {} }: LogEventParams) {
  try {
    const db = await getDb()

    // Log the event
    await db.insert(taskEvents).values({
      taskId,
      eventType,
      fromStatus,
      toStatus,
      metadata,
    })

    // Get the task to find its client
    const [task] = await db
      .select({
        id: tasks.id,
        clientId: tasks.clientId,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)

    if (!task?.clientId) return

    // Get the client name
    const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, task.clientId)).limit(1)

    if (!client) return

    // If this is a deferral, increment the avoidance score for the client
    if (eventType === "deferred" || eventType === "demoted") {
      await db
        .update(clientMemory)
        .set({
          avoidanceScore: sql`COALESCE(avoidance_score, 0) + 1`,
          updatedAt: new Date(),
        })
        .where(eq(clientMemory.clientName, client.name))
    }

    // If completed, update client memory
    if (eventType === "completed") {
      await db
        .update(clientMemory)
        .set({
          lastTaskAt: new Date(),
          totalTasks: sql`COALESCE(total_tasks, 0) + 1`,
          staleDays: 0,
          updatedAt: new Date(),
        })
        .where(eq(clientMemory.clientName, client.name))
    }
  } catch (err) {
    console.error("[events] Failed to log task event:", err)
  }
}

// Legacy alias
export const logMoveEvent = (params: { moveId: number; eventType: EventType; fromStatus?: string; toStatus?: string; metadata?: Record<string, any> }) => {
  return logTaskEvent({ ...params, taskId: params.moveId })
}

// Get event history for a task
export async function getTaskHistory(taskId: number) {
  try {
    const db = await getDb()
    return db.select().from(taskEvents).where(eq(taskEvents.taskId, taskId)).orderBy(taskEvents.createdAt)
  } catch (err) {
    console.error("[events] Failed to get task history:", err)
    return []
  }
}

// Legacy alias
export const getMoveHistory = getTaskHistory

// Count deferrals for a specific task
export async function getDeferralCount(taskId: number): Promise<number> {
  try {
    const db = await getDb()
    const events = await db.select().from(taskEvents).where(eq(taskEvents.taskId, taskId))

    return events.filter((e) => e.eventType === "deferred" || e.eventType === "demoted").length
  } catch (err) {
    console.error("[events] Failed to get deferral count:", err)
    return 0
  }
}

// Determine event type from status change
export function determineEventType(fromStatus: string | undefined, toStatus: string): EventType {
  if (!fromStatus) return "created"
  if (toStatus === "done") return "completed"
  if (fromStatus === "done") return "reopened"

  const statusPriority: Record<string, number> = {
    active: 4,
    queued: 3,
    backlog: 2,
    done: 1,
  }

  const fromPriority = statusPriority[fromStatus] ?? 0
  const toPriority = statusPriority[toStatus] ?? 0

  if (toPriority > fromPriority) return "promoted"
  if (toPriority < fromPriority) return "demoted"
  return "edited"
}
