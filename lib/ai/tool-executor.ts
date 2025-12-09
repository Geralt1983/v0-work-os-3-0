import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, and, ne } from "drizzle-orm"
import { generateAvoidanceReport } from "@/lib/ai/avoidance"
import { getMoveHistory, logMoveEvent } from "@/lib/events"
import { checkAndSendMilestone } from "@/lib/milestone-checker"

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

    case "search_moves": {
      const query = (args.query as string).toLowerCase()
      const clientName = args.client_name as string | undefined
      const status = args.status as string | undefined

      // Get all moves with client info
      const allMoves = await db
        .select({
          id: moves.id,
          title: moves.title,
          status: moves.status,
          clientId: moves.clientId,
          clientName: clients.name,
          drainType: moves.drainType,
          effortEstimate: moves.effortEstimate,
        })
        .from(moves)
        .leftJoin(clients, eq(moves.clientId, clients.id))

      // Filter by query, client, and status
      const filtered = allMoves.filter((m) => {
        const titleMatch = m.title.toLowerCase().includes(query)
        const clientMatch =
          !clientName || (m.clientName && m.clientName.toLowerCase().includes(clientName.toLowerCase()))
        const statusMatch = !status || m.status === status
        return titleMatch && clientMatch && statusMatch
      })

      return {
        moves: filtered.slice(0, 10),
        total: filtered.length,
        message:
          filtered.length === 0 ? "No moves found matching that query" : `Found ${filtered.length} matching moves`,
      }
    }

    case "create_move": {
      let clientId = null
      if (args.client_name) {
        const clientNameLower = (args.client_name as string).toLowerCase()
        const allClients = await db.select().from(clients)
        const matchedClient = allClients.find(
          (c) => c.name.toLowerCase().includes(clientNameLower) || clientNameLower.includes(c.name.toLowerCase()),
        )
        clientId = matchedClient?.id || null

        if (!matchedClient) {
          return { success: false, error: `No client found matching "${args.client_name}"` }
        }
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

    case "update_move": {
      const moveId = args.move_id as number
      const updates: Record<string, unknown> = { updatedAt: new Date() }

      if (args.title) updates.title = args.title
      if (args.description !== undefined) updates.description = args.description
      if (args.status) updates.status = args.status
      if (args.effort_estimate) updates.effortEstimate = args.effort_estimate
      if (args.drain_type) updates.drainType = args.drain_type

      const [updated] = await db.update(moves).set(updates).where(eq(moves.id, moveId)).returning()

      if (!updated) {
        return { success: false, error: `Move ${moveId} not found` }
      }

      return { success: true, move: updated }
    }

    case "complete_move": {
      const [currentMove] = await db
        .select({ status: moves.status, title: moves.title })
        .from(moves)
        .where(eq(moves.id, args.move_id as number))
        .limit(1)

      if (!currentMove) {
        return { success: false, error: `Move ${args.move_id} not found` }
      }

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

      let milestoneResult = null
      try {
        milestoneResult = await checkAndSendMilestone()
        console.log("[tool-executor] Milestone check result:", milestoneResult)
      } catch (notifyErr) {
        console.error("[tool-executor] Milestone notification check failed:", notifyErr)
      }

      return {
        success: true,
        move: updated,
        message: `Completed "${currentMove.title}"`,
        milestone: milestoneResult,
      }
    }

    case "delete_move": {
      const [existingMove] = await db
        .select({ id: moves.id, title: moves.title })
        .from(moves)
        .where(eq(moves.id, args.move_id as number))
        .limit(1)

      if (!existingMove) {
        return { success: false, error: `Move ${args.move_id} not found` }
      }

      await db.delete(moves).where(eq(moves.id, args.move_id as number))

      return { success: true, message: `Deleted "${existingMove.title}"` }
    }

    case "promote_move": {
      const [currentMove] = await db
        .select({ status: moves.status, title: moves.title })
        .from(moves)
        .where(eq(moves.id, args.move_id as number))
        .limit(1)

      if (!currentMove) {
        return { success: false, error: `Move ${args.move_id} not found` }
      }

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

      return { success: true, move: updated, message: `Promoted "${currentMove.title}" to ${args.target}` }
    }

    case "demote_move": {
      const [currentMove] = await db
        .select({ status: moves.status, title: moves.title })
        .from(moves)
        .where(eq(moves.id, args.move_id as number))
        .limit(1)

      if (!currentMove) {
        return { success: false, error: `Move ${args.move_id} not found` }
      }

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
        eventType: "demoted",
        fromStatus: currentMove?.status,
        toStatus: args.target as string,
      })

      return { success: true, move: updated, message: `Demoted "${currentMove.title}" to ${args.target}` }
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
