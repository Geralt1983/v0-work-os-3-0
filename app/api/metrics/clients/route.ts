import { NextResponse } from "next/server"
import { getDb, isPreviewWithoutDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { MOCK_CLIENTS, MOCK_TASKS } from "@/lib/mock-data"

export async function GET() {
  try {
    // Return mock data in preview mode without database
    if (isPreviewWithoutDb()) {
      console.log("[v0] Metrics/clients API: Using mock data (preview mode)")
      const mockMetrics = MOCK_CLIENTS.map((client) => {
        const clientTasks = MOCK_TASKS.filter((t) => t.clientId === client.id)
        const completedTasks = clientTasks.filter((t) => t.status === "done")
        return {
          clientId: client.id,
          clientName: client.name,
          totalTasks: clientTasks.length,
          completedTasks: completedTasks.length,
          activeTasks: clientTasks.length - completedTasks.length,
          daysSinceLastTask: Math.floor(Math.random() * 5),
          isStale: Math.random() > 0.7,
        }
      })
      return NextResponse.json(mockMetrics)
    }
    
    const db = getDb()
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const allTasks = await db.select().from(tasks)

    const metrics = allClients.map((client) => {
      const clientTasks = allTasks.filter((m) => m.clientId === client.id)
      const completedTasks = clientTasks.filter((m) => m.status === "done")
      const activeTasks = clientTasks.filter((m) => m.status !== "done")

      const lastCompleted = completedTasks.sort(
        (a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0),
      )[0]

      const daysSinceLastTask = lastCompleted?.completedAt
        ? Math.floor((Date.now() - lastCompleted.completedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        clientId: client.id,
        clientName: client.name,
        totalTasks: clientTasks.length,
        completedTasks: completedTasks.length,
        activeTasks: activeTasks.length,
        daysSinceLastTask,
        isStale: daysSinceLastTask !== null && daysSinceLastTask > 2,
      }
    })

    return NextResponse.json(metrics)
  } catch (error) {
    console.error("Failed to fetch client metrics:", error)
    return NextResponse.json({ error: "Failed to fetch client metrics" }, { status: 500 })
  }
}
