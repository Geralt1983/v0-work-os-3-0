import { getDb } from "./db"
import { tasks, taskGraveyard, clients } from "./schema"
import { eq, and, lte } from "drizzle-orm"

export interface DecayStatus {
  id: number
  title: string
  clientName: string
  daysInBacklog: number
  status: "normal" | "aging" | "stale" | "critical"
}

export async function getBacklogWithDecay(): Promise<DecayStatus[]> {
  const db = getDb()

  const backlogTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      clientId: tasks.clientId,
      createdAt: tasks.createdAt,
      clientName: clients.name,
    })
    .from(tasks)
    .leftJoin(clients, eq(tasks.clientId, clients.id))
    .where(eq(tasks.status, "backlog"))

  return backlogTasks.map((task) => {
    const createdAt = task.createdAt
    const daysInBacklog = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))

    let status: DecayStatus["status"] = "normal"
    if (daysInBacklog >= 21) status = "critical"
    else if (daysInBacklog >= 14) status = "stale"
    else if (daysInBacklog >= 7) status = "aging"

    return {
      id: task.id,
      title: task.title,
      clientName: task.clientName || "Unknown",
      daysInBacklog,
      status,
    }
  })
}

export async function archiveTask(taskId: number, reason = "manual") {
  const db = getDb()

  const [task] = await db
    .select({
      id: tasks.id,
      clientId: tasks.clientId,
      title: tasks.title,
      description: tasks.description,
      effortEstimate: tasks.effortEstimate,
      drainType: tasks.drainType,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))

  if (!task) throw new Error("Task not found")

  const daysInBacklog = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24))

  // Move to graveyard
  await db.insert(taskGraveyard).values({
    originalTaskId: task.id,
    clientId: task.clientId,
    title: task.title,
    description: task.description,
    effortEstimate: task.effortEstimate,
    drainType: task.drainType,
    archiveReason: reason,
    originalCreatedAt: task.createdAt,
    daysInBacklog,
  })

  // Delete original
  await db.delete(tasks).where(eq(tasks.id, taskId))

  return { archived: true, daysInBacklog }
}

export async function resurrectTask(graveyardId: number) {
  const db = getDb()

  const [archived] = await db.select().from(taskGraveyard).where(eq(taskGraveyard.id, graveyardId))

  if (!archived) throw new Error("Archived task not found")

  // Recreate task
  const [newTask] = await db
    .insert(tasks)
    .values({
      clientId: archived.clientId,
      title: archived.title,
      description: archived.description,
      effortEstimate: archived.effortEstimate,
      drainType: archived.drainType,
      status: "backlog",
    })
    .returning()

  // Remove from graveyard
  await db.delete(taskGraveyard).where(eq(taskGraveyard.id, graveyardId))

  return newTask
}

export async function runAutoDecay() {
  const db = getDb()

  // Find tasks that have been in backlog 30+ days
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - 30)

  const expiredTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.status, "backlog"), lte(tasks.createdAt, threshold)))

  const archived = []
  for (const task of expiredTasks) {
    await archiveTask(task.id, "auto_decay")
    archived.push(task.title)
  }

  return { archivedCount: archived.length, titles: archived }
}

export async function getAgingReport() {
  const decay = await getBacklogWithDecay()

  return {
    aging: decay.filter((d) => d.status === "aging"),
    stale: decay.filter((d) => d.status === "stale"),
    critical: decay.filter((d) => d.status === "critical"),
    totalBacklog: decay.length,
  }
}
