import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, and, ne } from "drizzle-orm"
import { generateAvoidanceReport } from "@/lib/ai/avoidance"
import { getMoveHistory, logMoveEvent } from "@/lib/events"

export async function executeTool(name: string, args: Record<string, unknown>) {
  const db = getDb()

  switch (name) {
    case "get_all_client_pipelines": {
      const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
      const allMoves = await db.select().from(moves).where(ne(moves.status, "done"))

      const pipelines = allClients.map((client) => {
        const clientMoves = allMoves.filter((m) => m.clientId === client.id)
        return {
          clientName: client.name,
          clientId: client.id,
          active: clientMoves.filter((m) => m.status === "active"),
          queued: clientMoves.filter((m) => m.status === "queued"),
          backlog: clientMoves.filter((m) => m.status === "backlog"),
        }
      })

      return { pipelines }
    }

    case "create_move": {
      let clientId = null
      if (args.client_name) {
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.name, args.client_name as string))
        clientId = client?.id || null
      }

      const [newMove] = await db
        .insert(moves)
        .values({
          title: args.title as string,
          clientId,
          description: (args.description as string) || null,
          status: (args.status as string) || "backlog",
          effortEstimate: (args.effort_estimate as number) || 2,
          drainType: (args.drain_type as string) || null,
          updatedAt: new Date(),
        })
        .returning()

      await logMoveEvent({
        moveId: newMove.id,
        eventType: "created",
        toStatus: newMove.status,
      })

      return { success: true, move: newMove }
    }

    case "complete_move": {
      const [currentMove] = await db
        .select({ status: moves.status })
        .from(moves)
        .where(eq(moves.id, args.move_id as number))
        .limit(1)

      const [updated] = await db
        .update(moves)
        .set({
          status: "done",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(moves.id, args.move_id as number))
        .returning()

      await logMoveEvent({
        moveId: args.move_id as number,
        eventType: "completed",
        fromStatus: currentMove?.status,
        toStatus: "done",
      })

      // Trigger milestone notification check (same as direct API endpoint)
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000"
        await fetch(`${baseUrl}/api/notifications/milestone`, { method: "POST" })
      } catch (notifyErr) {
        console.log("[tool-executor] Milestone notification check failed:", notifyErr)
      }

      return { success: true, move: updated }
    }

    case "promote_move": {
      const [currentMove] = await db
        .select({ status: moves.status })
        .from(moves)
        .where(eq(moves.id, args.move_id as number))
        .limit(1)

      const [updated] = await db
        .update(moves)
        .set({
          status: args.target as string,
          updatedAt: new Date(),
        })
        .where(eq(moves.id, args.move_id as number))
        .returning()

      await logMoveEvent({
        moveId: args.move_id as number,
        eventType: "promoted",
        fromStatus: currentMove?.status,
        toStatus: args.target as string,
      })

      return { success: true, move: updated }
    }

    case "suggest_next_move": {
      const activeMoves = await db
        .select()
        .from(moves)
        .where(and(eq(moves.status, "active"), ne(moves.status, "done")))
      const queuedMoves = await db.select().from(moves).where(eq(moves.status, "queued"))

      const suggestion = queuedMoves[0] || activeMoves[0]
      return {
        suggestion: suggestion
          ? {
              id: suggestion.id,
              title: suggestion.title,
              drainType: suggestion.drainType,
            }
          : null,
        reason: "Based on current pipeline state",
      }
    }

    case "get_avoidance_report": {
      const report = await generateAvoidanceReport()
      return { report }
    }

    case "get_move_history": {
      const history = await getMoveHistory(args.move_id as number)
      return { history }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
