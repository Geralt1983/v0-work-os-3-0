import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, ne, and, inArray } from "drizzle-orm"

export async function POST() {
  try {
    const db = getDb()

    // Fetch all active external clients
    const allClients = await db
      .select()
      .from(clients)
      .where(and(eq(clients.isActive, 1), ne(clients.type, "internal")))

    const clientIds = allClients.map((c) => c.id)
    if (clientIds.length === 0) {
      return NextResponse.json({ success: true, actionsCount: 0, actions: [] })
    }

    // Single query: fetch all non-done tasks for all clients (eliminates N+1)
    const allTasks = await db
      .select()
      .from(tasks)
      .where(and(inArray(tasks.clientId, clientIds), ne(tasks.status, "done")))

    // Group tasks by clientId in memory
    const tasksByClient = new Map<number, typeof allTasks>()
    for (const task of allTasks) {
      if (!task.clientId) continue
      const existing = tasksByClient.get(task.clientId) || []
      existing.push(task)
      tasksByClient.set(task.clientId, existing)
    }

    // Build client name lookup
    const clientNames = new Map(allClients.map((c) => [c.id, c.name]))

    const actions: { action: string; clientName: string; taskTitle?: string }[] = []
    const updates: { id: number; status: string }[] = []

    for (const [clientId, clientTasks] of tasksByClient) {
      const active = clientTasks.filter((t) => t.status === "active")
      const queued = clientTasks.filter((t) => t.status === "queued")
      const backlog = clientTasks.filter((t) => t.status === "backlog")

      // Auto-promote if missing active
      if (active.length === 0 && queued.length > 0) {
        const toPromote = queued[0]
        updates.push({ id: toPromote.id, status: "active" })
        actions.push({
          action: "promoted_to_active",
          clientName: clientNames.get(clientId) || "",
          taskTitle: toPromote.title,
        })
      }

      // Auto-promote if missing queued
      if (queued.length === 0 && backlog.length > 0) {
        const toPromote = backlog[0]
        updates.push({ id: toPromote.id, status: "queued" })
        actions.push({
          action: "promoted_to_queued",
          clientName: clientNames.get(clientId) || "",
          taskTitle: toPromote.title,
        })
      }
    }

    // Execute all updates
    const now = new Date()
    for (const update of updates) {
      await db.update(tasks).set({ status: update.status, updatedAt: now }).where(eq(tasks.id, update.id))
    }

    return NextResponse.json({
      success: true,
      actionsCount: actions.length,
      actions,
    })
  } catch (error) {
    console.error("Failed to auto-fix:", error)
    return NextResponse.json({ error: "Failed to auto-fix" }, { status: 500 })
  }
}
