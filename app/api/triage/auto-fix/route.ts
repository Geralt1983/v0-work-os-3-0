import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, ne, and } from "drizzle-orm"

export async function POST() {
  try {
    const allClients = await db
      .select()
      .from(clients)
      .where(and(eq(clients.isActive, 1), ne(clients.type, "internal")))

    const actions: { action: string; clientName: string; moveTitle?: string }[] = []

    for (const client of allClients) {
      const clientMoves = await db
        .select()
        .from(moves)
        .where(and(eq(moves.clientId, client.id), ne(moves.status, "done")))

      const active = clientMoves.filter((m) => m.status === "active")
      const queued = clientMoves.filter((m) => m.status === "queued")
      const backlog = clientMoves.filter((m) => m.status === "backlog")

      // Auto-promote if missing active
      if (active.length === 0 && queued.length > 0) {
        const toPromote = queued[0]
        await db.update(moves).set({ status: "active", updatedAt: new Date() }).where(eq(moves.id, toPromote.id))
        actions.push({
          action: "promoted_to_active",
          clientName: client.name,
          moveTitle: toPromote.title,
        })
      }

      // Auto-promote if missing queued
      if (queued.length === 0 && backlog.length > 0) {
        const toPromote = backlog[0]
        await db.update(moves).set({ status: "queued", updatedAt: new Date() }).where(eq(moves.id, toPromote.id))
        actions.push({
          action: "promoted_to_queued",
          clientName: client.name,
          moveTitle: toPromote.title,
        })
      }
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
