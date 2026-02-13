import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, and, ne } from "drizzle-orm"
import { generateAvoidanceReport } from "@/lib/ai/avoidance"
import { getTaskHistory, logTaskEvent } from "@/lib/events"
import { checkAndSendMilestone } from "@/lib/milestone-checker"
import { generateText } from "ai"

const DECOMPOSITION_SYSTEM_PROMPT = `
You are ThanosAI, a productivity coach specializing in decomposition.

Break work into 2-6 concrete subtasks that:
- Start with strong verbs
- Are specific and measurable
- Are ordered logically
- Stay within original scope

Rules:
- Return ONLY a JSON array of strings
- Each subtask must be a single sentence
`

function parseSubtasks(raw: string): string[] | null {
  try {
    const cleanedText = raw.trim().replace(/```json\n?|\n?```/g, "")
    const parsed = JSON.parse(cleanedText)
    if (!Array.isArray(parsed)) return null
    const normalized = parsed.filter((v) => typeof v === "string").map((v) => v.trim()).filter(Boolean)
    return normalized.length > 0 ? normalized : null
  } catch {
    return null
  }
}

export async function executeTool(name: string, args: Record<string, unknown>) {
  const db = getDb()

  switch (name) {
    case "get_all_client_pipelines": {
      const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
      const allTasks = await db.select().from(tasks).where(ne(tasks.status, "done"))

      const pipelines = allClients.map((client) => {
        const clientTasks = allTasks.filter((t) => t.clientId === client.id)
        return {
          clientName: client.name,
          clientId: client.id,
          active: clientTasks.filter((t) => t.status === "active"),
          queued: clientTasks.filter((t) => t.status === "queued"),
          backlog: clientTasks.filter((t) => t.status === "backlog"),
        }
      })

      return { pipelines }
    }

    case "search_tasks": {
      const query = (args.query as string).toLowerCase()
      const clientName = args.client_name as string | undefined
      const status = args.status as string | undefined

      // Get all tasks with client info
      const allTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          clientId: tasks.clientId,
          clientName: clients.name,
          drainType: tasks.drainType,
          effortEstimate: tasks.effortEstimate,
        })
        .from(tasks)
        .leftJoin(clients, eq(tasks.clientId, clients.id))

      // Filter by query, client, and status
      const filtered = allTasks.filter((t) => {
        const titleMatch = t.title.toLowerCase().includes(query)
        const queryClientMatch = t.clientName ? t.clientName.toLowerCase().includes(query) : false
        const queryMatch = titleMatch || queryClientMatch
        const clientMatch =
          !clientName || (t.clientName && t.clientName.toLowerCase().includes(clientName.toLowerCase()))
        const statusMatch = !status || t.status === status
        return queryMatch && clientMatch && statusMatch
      })

      return {
        tasks: filtered.slice(0, 10),
        total: filtered.length,
        message:
          filtered.length === 0 ? "No tasks found matching that query" : `Found ${filtered.length} matching tasks`,
      }
    }

    case "decompose_task": {
      const rawQuery = String(args.query || "").trim()
      if (!rawQuery) {
        return { success: false, error: "query is required" }
      }

      const maxSubtasks = Number(args.max_subtasks || 4)
      const safeMaxSubtasks = [2, 3, 4, 5, 6].includes(maxSubtasks) ? maxSubtasks : 4
      const ragContext = String(args.rag_context || "").trim()
      const normalizedQuery = rawQuery.toLowerCase()

      const allTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          clientId: tasks.clientId,
          clientName: clients.name,
        })
        .from(tasks)
        .leftJoin(clients, eq(tasks.clientId, clients.id))
        .where(ne(tasks.status, "done"))

      const idMatch = rawQuery.match(/#?(\d{1,8})\b/)
      const requestedId = idMatch ? Number(idMatch[1]) : null

      let matchedTask =
        (requestedId ? allTasks.find((task) => task.id === requestedId) : undefined) ||
        allTasks.find((task) => task.title.toLowerCase() === normalizedQuery) ||
        allTasks.find((task) => task.title.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes(task.title.toLowerCase()))

      if (!matchedTask && allTasks.length > 0) {
        const ranked = allTasks
          .map((task) => {
            const haystack = `${task.title} ${task.description || ""} ${task.clientName || ""}`.toLowerCase()
            const overlap = normalizedQuery
              .split(/\s+/)
              .filter((token) => token.length > 2 && haystack.includes(token)).length
            return { task, overlap }
          })
          .filter((entry) => entry.overlap > 0)
          .sort((a, b) => b.overlap - a.overlap)
        matchedTask = ranked[0]?.task
      }

      const sourceTitle = matchedTask?.title || rawQuery
      const sourceDescription = matchedTask?.description || ""
      const sourceClient = matchedTask?.clientName || ""

      const prompt = `
Task: "${sourceTitle}"
${sourceDescription ? `Description: "${sourceDescription}"` : ""}
${sourceClient ? `Client: ${sourceClient}` : ""}
Requested subtask count: ${safeMaxSubtasks}
${ragContext ? `Retrieved context: "${ragContext}"` : ""}

Break this into smaller subtasks. Return only a JSON array of strings.
`.trim()

      try {
        const result = await generateText({
          model: "openai/gpt-4o-mini",
          system: DECOMPOSITION_SYSTEM_PROMPT,
          prompt,
        })

        const parsed = parseSubtasks(result.text)
        if (parsed && parsed.length > 0) {
          return {
            success: true,
            task: matchedTask ? { id: matchedTask.id, title: matchedTask.title } : null,
            subtasks: parsed.slice(0, safeMaxSubtasks),
            source: matchedTask ? "matched_task" : "freeform_query",
          }
        }
      } catch {
        // Fall through to deterministic fallback below.
      }

      return {
        success: true,
        task: matchedTask ? { id: matchedTask.id, title: matchedTask.title } : null,
        subtasks: [
          `Clarify acceptance criteria and constraints for ${sourceTitle}.`,
          `Execute the core implementation work for ${sourceTitle}.`,
          `Validate results, fix issues, and prepare final handoff for ${sourceTitle}.`,
        ].slice(0, safeMaxSubtasks),
        source: "fallback",
      }
    }

    case "create_task": {
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

      const [newTask] = await db
        .insert(tasks)
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

      await logTaskEvent({
        taskId: newTask.id,
        eventType: "created",
        toStatus: newTask.status,
      })

      return { success: true, task: newTask }
    }

    case "update_task": {
      const taskId = args.task_id as number
      const updates: Record<string, unknown> = { updatedAt: new Date() }

      if (args.title) updates.title = args.title
      if (args.description !== undefined) updates.description = args.description
      if (args.status) updates.status = args.status
      if (args.effort_estimate) updates.effortEstimate = args.effort_estimate
      if (args.drain_type) updates.drainType = args.drain_type

      const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, taskId)).returning()

      if (!updated) {
        return { success: false, error: `Task ${taskId} not found` }
      }

      return { success: true, task: updated }
    }

    case "complete_task": {
      const [currentTask] = await db
        .select({ status: tasks.status, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.id, args.task_id as number))
        .limit(1)

      if (!currentTask) {
        return { success: false, error: `Task ${args.task_id} not found` }
      }

      const [updated] = await db
        .update(tasks)
        .set({
          status: "done",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, args.task_id as number))
        .returning()

      await logTaskEvent({
        taskId: args.task_id as number,
        eventType: "completed",
        fromStatus: currentTask?.status,
        toStatus: "done",
      })

      /*
      let milestoneResult = null
      try {
        milestoneResult = await checkAndSendMilestone()
        console.log("[tool-executor] Milestone check result:", milestoneResult)
      } catch (notifyErr) {
        console.error("[tool-executor] Milestone notification check failed:", notifyErr)
      }
      */

      return {
        success: true,
        task: updated,
        message: `Completed "${currentTask.title}"`,
        milestone: null, // Milestone notifications disabled
      }
    }

    case "delete_task": {
      const [existingTask] = await db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.id, args.task_id as number))
        .limit(1)

      if (!existingTask) {
        return { success: false, error: `Task ${args.task_id} not found` }
      }

      await db.delete(tasks).where(eq(tasks.id, args.task_id as number))

      return { success: true, message: `Deleted "${existingTask.title}"` }
    }

    case "promote_task": {
      const [currentTask] = await db
        .select({ status: tasks.status, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.id, args.task_id as number))
        .limit(1)

      if (!currentTask) {
        return { success: false, error: `Task ${args.task_id} not found` }
      }

      const [updated] = await db
        .update(tasks)
        .set({
          status: args.target as string,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, args.task_id as number))
        .returning()

      await logTaskEvent({
        taskId: args.task_id as number,
        eventType: "promoted",
        fromStatus: currentTask?.status,
        toStatus: args.target as string,
      })

      return { success: true, task: updated, message: `Promoted "${currentTask.title}" to ${args.target}` }
    }

    case "demote_task": {
      const [currentTask] = await db
        .select({ status: tasks.status, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.id, args.task_id as number))
        .limit(1)

      if (!currentTask) {
        return { success: false, error: `Task ${args.task_id} not found` }
      }

      const [updated] = await db
        .update(tasks)
        .set({
          status: args.target as string,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, args.task_id as number))
        .returning()

      await logTaskEvent({
        taskId: args.task_id as number,
        eventType: "demoted",
        fromStatus: currentTask?.status,
        toStatus: args.target as string,
      })

      return { success: true, task: updated, message: `Demoted "${currentTask.title}" to ${args.target}` }
    }

    case "suggest_next_task": {
      const activeTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.status, "active"), ne(tasks.status, "done")))
      const queuedTasks = await db.select().from(tasks).where(eq(tasks.status, "queued"))

      const suggestion = queuedTasks[0] || activeTasks[0]
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

    case "get_task_history": {
      const history = await getTaskHistory(args.task_id as number)
      return { history }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
