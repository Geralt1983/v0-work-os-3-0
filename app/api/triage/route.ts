import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, ne } from "drizzle-orm"

export async function GET() {
  try {
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    const allMoves = await db.select().from(moves).where(ne(moves.status, "done"))

    const issues: { clientName: string; issues: string[] }[] = []
    const missingFields: { moveId: number; title: string; clientName: string; missing: string[] }[] = []

    for (const client of allClients) {
      if (client.type === "internal") continue

      const clientMoves = allMoves.filter((m) => m.clientId === client.id)
      const active = clientMoves.filter((m) => m.status === "active")
      const queued = clientMoves.filter((m) => m.status === "queued")
      const backlog = clientMoves.filter((m) => m.status === "backlog")

      const clientIssues: string[] = []
      if (active.length === 0) clientIssues.push("No active move")
      if (queued.length === 0) clientIssues.push("No queued move")
      if (backlog.length === 0) clientIssues.push("Empty backlog")

      if (clientIssues.length > 0) {
        issues.push({ clientName: client.name, issues: clientIssues })
      }

      // Check for missing fields
      for (const move of clientMoves) {
        const missing: string[] = []
        if (!move.drainType) missing.push("drain type")
        if (!move.effortEstimate) missing.push("effort estimate")

        if (missing.length > 0) {
          missingFields.push({
            moveId: move.id,
            title: move.title,
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
