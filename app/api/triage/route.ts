import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, ne } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const allTasks = await db.select().from(tasks).where(ne(tasks.status, "done"))

    const issues: { clientName: string; issues: string[] }[] = []
    const missingFields: { taskId: number; title: string; clientName: string; missing: string[] }[] = []

    for (const client of allClients) {
      if (client.type === "internal") continue

      const clientTasks = allTasks.filter((t) => t.clientId === client.id)
      const active = clientTasks.filter((t) => t.status === "active")
      const queued = clientTasks.filter((t) => t.status === "queued")
      const backlog = clientTasks.filter((t) => t.status === "backlog")

      const clientIssues: string[] = []
      if (active.length === 0) clientIssues.push("No active task")
      if (queued.length === 0) clientIssues.push("No queued task")
      if (backlog.length === 0) clientIssues.push("Empty backlog")

      if (clientIssues.length > 0) {
        issues.push({ clientName: client.name, issues: clientIssues })
      }

      // Check for missing fields
      for (const task of clientTasks) {
        const missing: string[] = []
        if (!task.drainType) missing.push("drain type")
        if (!task.effortEstimate) missing.push("effort estimate")

        if (missing.length > 0) {
          missingFields.push({
            taskId: task.id,
            title: task.title,
            clientName: client.name,
            missing,
          })
        }
      }
    }

    return NextResponse.json({
      date: new Date().toISOString().split("T")[0],
      pipelineHealth: {
        totalClients: allClients.filter((c) => c.type !== "internal").length,
        healthyClients: allClients.filter((c) => c.type !== "internal").length - issues.length,
        clientsWithIssues: issues,
      },
      missingFields,
      summary: {
        totalIssues: issues.reduce((sum, i) => sum + i.issues.length, 0) + missingFields.length,
        isHealthy: issues.length === 0 && missingFields.length === 0,
      },
    })
  } catch (error) {
    console.error("Failed to run triage:", error)
    return NextResponse.json({ error: "Failed to run triage" }, { status: 500 })
  }
}
