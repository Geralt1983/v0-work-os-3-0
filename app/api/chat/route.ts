import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sessions, messages, tasks, clients, messageAttachments } from "@/lib/schema"
import { eq, asc, ne } from "drizzle-orm"
import { randomUUID } from "crypto"
import OpenAI from "openai"
import { WORK_OS_PROMPT } from "@/lib/ai/prompts"
import { chatTools } from "@/lib/ai/tools"
import { executeTool } from "@/lib/ai/tool-executor"
import { getAvoidanceSummary } from "@/lib/ai/avoidance"
import { shouldForceDecompositionWorkflow } from "@/lib/ai/decomposition-intent"
import {
  buildMergedContextBlock,
  buildDecompositionRagContext,
  type NotebookRoutingMode,
  type NotebookRoutingMetadata,
} from "@/lib/ai/chat-context"
import { resolveIngestionRoute, type IngestionSource, type SourceMetadata } from "@/lib/ai/ingestion-routing"
import { getPersonalTaskFailureFallback, logPersonalTaskToolFailure } from "@/lib/ai/personal-task-fallback"
import { execFile } from "child_process"
import { promisify } from "util"
import os from "os"
import path from "path"

const execFileAsync = promisify(execFile)

async function getCurrentTaskContext(): Promise<string> {
  const db = getDb()

  // Get all active clients
  const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))

  // Get all non-done tasks
  const allTasks = await db.select().from(tasks).where(ne(tasks.status, "done"))

  const lines: string[] = ["## CLIENTS (for clientId)"]
  allClients.forEach(c => lines.push(`- ${c.name}: id=${c.id}`))

  lines.push("\n## CURRENT TASKS")

  for (const client of allClients) {
    const clientTasks = allTasks.filter(t => t.clientId === client.id)
    const active = clientTasks.filter(t => t.status === "active")
    const queued = clientTasks.filter(t => t.status === "queued")

    if (active.length > 0 || queued.length > 0) {
      lines.push(`\n### ${client.name} (clientId=${client.id})`)
      if (active.length > 0) {
        lines.push("Active:")
        active.forEach(t => lines.push(`- [id=${t.id}] ${t.title}`))
      }
      if (queued.length > 0) {
        lines.push("Queued:")
        queued.forEach(t => lines.push(`- [id=${t.id}] ${t.title}`))
      }
    }
  }

  // Tasks without clients
  const noClientTasks = allTasks.filter(t => !t.clientId && (t.status === "active" || t.status === "queued"))
  if (noClientTasks.length > 0) {
    lines.push("\n### General (clientId=null)")
    noClientTasks.filter(t => t.status === "active").forEach(t => lines.push(`- [id=${t.id}] ${t.title}`))
    noClientTasks.filter(t => t.status === "queued").forEach(t => lines.push(`- [id=${t.id}] ${t.title}`))
  }

  if (allTasks.length === 0) {
    lines.push("\nNo active or queued tasks.")
  }

  return lines.join("\n")
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const openclawBaseUrl = process.env.OPENCLAW_URL?.replace(/\/$/, "")
const openclaw = openclawBaseUrl
  ? new OpenAI({
      apiKey: process.env.OPENCLAW_TOKEN,
      baseURL: `${openclawBaseUrl}/v1`,
      timeout: 30000, // 30 second timeout
      maxRetries: 1 // Only retry once
    })
  : null
const openclawEnabled = process.env.OPENCLAW_ENABLED === "true"

const ACTIVITY_OPEN = "[[ACTIVITY]]"
const ACTIVITY_CLOSE = "[[/ACTIVITY]]"
const MAX_DECOMPOSITION_RAG_CONTEXT_CHARS = 2200

type HistoryMessage = {
  role: string
  content: string
  timestamp: Date
  notebookId?: string | null
}

function buildForcedDecompositionResponse(result: unknown): string {
  const subtasksRaw = (result as { subtasks?: unknown })?.subtasks
  const subtasks = Array.isArray(subtasksRaw)
    ? subtasksRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []

  if (subtasks.length === 0) {
    return "I ran decomposition but couldn't generate usable subtasks. Please restate the task with a bit more detail."
  }

  return [
    "Here is the breakdown:",
    ...subtasks.map((step, idx) => `${idx + 1}. ${step}`),
    "",
    "Suggested sequence: execute in order and adjust if a blocker appears.",
  ].join("\n")
}

function stripActivity(content: string): string {
  const start = content.indexOf(ACTIVITY_OPEN)
  const end = content.indexOf(ACTIVITY_CLOSE)
  if (start === -1 || end === -1 || end <= start) {
    return content.trim()
  }
  const before = content.slice(0, start).trim()
  const after = content.slice(end + ACTIVITY_CLOSE.length).trim()
  return [before, after].filter(Boolean).join("\n\n").trim()
}

type TaskAction =
  | { type: "delete"; query: string }
  | { type: "complete"; query: string }
  | { type: "update"; query: string; newContent: string }
  | { type: "create"; query: string }

function cleanPersonalQuery(raw: string): string {
  return raw
    .replace(/that was a personal task/i, "")
    .replace(/\bpersonal task\b/i, "")
    .replace(/\bpersonal\b/i, "")
    .replace(/\btodoist\b/i, "")
    .trim()
}

function extractTaskAction(message: string): TaskAction | null {
  const text = String(message || "").trim()
  if (!text) return null

  const deleteMatch = text.match(/(?:get rid of|remove|delete|drop|clear)\s+(.*?)(?:\.|$)/i)
  if (deleteMatch?.[1]) {
    const query = cleanPersonalQuery(deleteMatch[1])
    if (query) return { type: "delete", query }
  }

  const completeMatch = text.match(/(?:complete|finish|mark(?:\s+as)?\s+done|check(?:\s+off)?|done with)\s+(.*?)(?:\.|$)/i)
  if (completeMatch?.[1]) {
    const query = cleanPersonalQuery(completeMatch[1])
    if (query) return { type: "complete", query }
  }

  const updateMatch = text.match(/(?:rename|change|update)\s+(.*?)\s+to\s+(.*?)(?:\.|$)/i)
  if (updateMatch?.[1] && updateMatch?.[2]) {
    const query = cleanPersonalQuery(updateMatch[1])
    const newContent = cleanPersonalQuery(updateMatch[2])
    if (query && newContent) return { type: "update", query, newContent }
  }

  const prefixedMatch = text.match(/^personal\s*[:\-]\s*(.+)$/i)
  if (prefixedMatch?.[1]) {
    const query = cleanPersonalQuery(prefixedMatch[1])
    if (query) return { type: "create", query }
  }

  const createMatch = text.match(/(?:add|create|new|remind me to)\s+(?:task\s+)?(?:to\s+)?(.+?)(?:\.|$)/i)
  if (createMatch?.[1]) {
    const query = cleanPersonalQuery(createMatch[1])
    if (query) return { type: "create", query }
  }

  return null
}

function findMentionedClient(message: string, clientNames: string[]): string | null {
  const lower = message.toLowerCase()
  for (const name of clientNames) {
    if (name && lower.includes(name.toLowerCase())) return name
  }
  return null
}

function shouldRequireToolCall(message: string): boolean {
  const text = String(message || "").trim().toLowerCase()
  if (!text) return false

  // Keep simple conversational turns free-form.
  if (/^(hi|hello|hey|thanks|thank you|yo)[!. ]*$/.test(text)) return false

  const taskActionPattern =
    /\b(add|create|new|remind|complete|finish|done|check off|mark as done|update|rename|change|delete|remove|drop|clear|promote|demote|move|start|defer)\b/
  const statusPattern =
    /\b(task|tasks|pipeline|active|queued|backlog|client|clients|status|history|avoidance|stale|what should i do|next task)\b/

  return taskActionPattern.test(text) || statusPattern.test(text)
}

type TaskDomain = "work" | "personal" | "unknown"

const WORK_KEYWORDS = [
  "client",
  "epic",
  "ehr",
  "citrix",
  "sow",
  "statement of work",
  "invoice",
  "billing",
  "timesheet",
  "contract",
  "go-live",
  "golive",
  "implementation",
  "status report",
  "deliverable",
  "proposal",
  "estimate",
  "scoping",
]

const PERSONAL_KEYWORDS = [
  "home",
  "house",
  "family",
  "kids",
  "baby",
  "wife",
  "pregnancy",
  "grocery",
  "shopping",
  "dentist",
  "doctor",
  "school",
  "birthday",
  "vacation",
  "trip",
  "garage",
  "yard",
  "lawn",
  "suburban",
  "car",
  "bathroom",
  "kitchen",
]

function classifyTaskDomain(message: string, clientNames: string[]): TaskDomain {
  const text = String(message || "").trim()
  if (!text) return "unknown"
  const lower = text.toLowerCase()

  const prefix = lower.match(/^\s*(work|personal)\s*[:\-]/)
  if (prefix?.[1] === "work") return "work"
  if (prefix?.[1] === "personal") return "personal"

  if (lower.includes("todoist")) return "personal"
  if (lower.includes("workos")) return "work"

  if (findMentionedClient(text, clientNames)) return "work"
  if (WORK_KEYWORDS.some((k) => lower.includes(k))) return "work"
  if (PERSONAL_KEYWORDS.some((k) => lower.includes(k))) return "personal"

  return "unknown"
}

async function callTodoist(tool: string, args: Record<string, string>): Promise<any> {
  const configPath =
    process.env.MCPORTER_CONFIG ||
    path.join(os.homedir(), ".openclaw", "workspace", "config", "mcporter.json")
  const argList = ["call", `todoist.${tool}`, ...Object.entries(args).map(([k, v]) => `${k}=${v}`), "--config", configPath]
  const { stdout } = await execFileAsync("mcporter", argList, { timeout: 15000 })
  return JSON.parse(stdout)
}

async function deleteTodoistTaskByQuery(query: string): Promise<{status: "deleted" | "not_found" | "multiple" | "error", message: string}> {
  try {
    const list = await callTodoist("list_tasks", { filter: `search: ${query}` })
    const results = Array.isArray(list?.results) ? list.results : []
    if (results.length === 0) {
      return { status: "not_found", message: `Couldn't find a personal task matching "${query}".` }
    }
    if (results.length > 1) {
      const titles = results.slice(0, 3).map((r: { content?: string }) => r.content || "Untitled").join("; ")
      return { status: "multiple", message: `I found multiple matches: ${titles}. Which one should I remove?` }
    }
    const taskId = String(results[0].id)
    await callTodoist("delete_task", { task_id: taskId })
    return { status: "deleted", message: `Done: removed "${results[0].content}".` }
  } catch (err) {
    logPersonalTaskToolFailure("delete", err)
    return { status: "error", message: getPersonalTaskFailureFallback("delete") }
  }
}

async function completeTodoistTaskByQuery(query: string): Promise<{status: "completed" | "not_found" | "multiple" | "error", message: string}> {
  try {
    const list = await callTodoist("list_tasks", { filter: `search: ${query}` })
    const results = Array.isArray(list?.results) ? list.results : []
    if (results.length === 0) {
      return { status: "not_found", message: `Couldn't find a personal task matching "${query}".` }
    }
    if (results.length > 1) {
      const titles = results.slice(0, 3).map((r: { content?: string }) => r.content || "Untitled").join("; ")
      return { status: "multiple", message: `I found multiple matches: ${titles}. Which one should I complete?` }
    }
    const taskId = String(results[0].id)
    await callTodoist("complete_task", { task_id: taskId })
    return { status: "completed", message: `Done: completed "${results[0].content}".` }
  } catch (err) {
    logPersonalTaskToolFailure("complete", err)
    return { status: "error", message: getPersonalTaskFailureFallback("complete") }
  }
}

async function updateTodoistTaskByQuery(query: string, newContent: string): Promise<{status: "updated" | "not_found" | "multiple" | "error", message: string}> {
  try {
    const list = await callTodoist("list_tasks", { filter: `search: ${query}` })
    const results = Array.isArray(list?.results) ? list.results : []
    if (results.length === 0) {
      return { status: "not_found", message: `Couldn't find a personal task matching "${query}".` }
    }
    if (results.length > 1) {
      const titles = results.slice(0, 3).map((r: { content?: string }) => r.content || "Untitled").join("; ")
      return { status: "multiple", message: `I found multiple matches: ${titles}. Which one should I update?` }
    }
    const taskId = String(results[0].id)
    await callTodoist("update_task", { task_id: taskId, content: newContent })
    return { status: "updated", message: `Done: updated to "${newContent}".` }
  } catch (err) {
    logPersonalTaskToolFailure("update", err)
    return { status: "error", message: getPersonalTaskFailureFallback("update") }
  }
}

async function createTodoistTask(content: string): Promise<{status: "created" | "error", message: string}> {
  try {
    const created = await callTodoist("create_task", { content })
    const title = created?.content || content
    return { status: "created", message: `Done: added "${title}".` }
  } catch (err) {
    logPersonalTaskToolFailure("create", err)
    return { status: "error", message: getPersonalTaskFailureFallback("create") }
  }
}

// Generate tool documentation for the system prompt
function getToolDocumentation(): string {
  const toolDocs = chatTools.map(t => {
    const params = t.function.parameters?.properties
      ? Object.entries(t.function.parameters.properties as Record<string, {type?: string, description?: string}>)
          .map(([k, v]) => `  - ${k}: ${v.type || 'any'} - ${v.description || ''}`)
          .join('\n')
      : '  (no parameters)'
    const required = t.function.parameters?.required || []
    return `**${t.function.name}**\n${t.function.description}\nParameters:\n${params}\nRequired: ${required.join(', ') || 'none'}`
  }).join('\n\n')

  return `## AVAILABLE TOOLS
To call a tool, output a fenced code block with language "tool":
\`\`\`tool
{"tool": "tool_name", "args": {"param": "value"}}
\`\`\`

${toolDocs}`
}

// Parse tool calls from assistant response
function parseToolCalls(content: string): Array<{tool: string, args: Record<string, unknown>}> | null {
  const toolCalls: Array<{tool: string, args: Record<string, unknown>}> = []

  // Match ```tool ... ``` blocks
  const fencedRegex = /```tool\s*\n?([\s\S]*?)\n?```/g
  let match
  while ((match = fencedRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.tool && typeof parsed.tool === 'string') {
        toolCalls.push({ tool: parsed.tool, args: parsed.args || {} })
      }
    } catch (e) {
      console.log('[chat] Failed to parse tool call:', match[1], e)
    }
  }

  // Also match TOOL: prefix format
  const inlineRegex = /TOOL:\s*({[^}]+})/g
  while ((match = inlineRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.tool && typeof parsed.tool === 'string') {
        toolCalls.push({ tool: parsed.tool, args: parsed.args || {} })
      }
    } catch (e) {
      console.log('[chat] Failed to parse inline tool call:', match[1], e)
    }
  }

  return toolCalls.length > 0 ? toolCalls : null
}

interface AttachmentInput {
  id: string
  url: string
  name: string
  mime: string
  size: number
  durationMs?: number
  transcription?: string
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const {
      sessionId: providedSessionId,
      message,
      imageBase64,
      attachments,
      activityMode,
      notebookId,
      ragRouteMode,
      candidateNotebookIds,
      source,
      sourceMetadata,
    } = await request.json() as {
      sessionId?: string
      message: string
      imageBase64?: string
      attachments?: AttachmentInput[]
      activityMode?: "show" | "hide" | boolean
      notebookId?: string
      ragRouteMode?: NotebookRoutingMode
      candidateNotebookIds?: string[]
      source?: IngestionSource
      sourceMetadata?: SourceMetadata
    }

    const sessionId = providedSessionId || randomUUID()

    // Check if session exists
    const existingSession = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)

    // Create session if it doesn't exist
    if (existingSession.length === 0) {
      await db.insert(sessions).values({
        id: sessionId,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      })
    }

    const activeClients = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.isActive, 1))
    const clientNames = activeClients.map((c) => c.name)
    const ingress = resolveIngestionRoute({
      content: message,
      source,
      notebookId,
      sourceMetadata,
    })
    const persistedNotebookId = ingress.notebookId
    const domain = classifyTaskDomain(message, clientNames)
    const action = extractTaskAction(message)
    const mentionedClient = findMentionedClient(message, clientNames)
    const requireToolCall = shouldRequireToolCall(message)
    const userMsgId = randomUUID()

    // Save user message after resolving notebook/source routing.
    await db.insert(messages).values({
      id: userMsgId,
      sessionId,
      role: "user",
      content: message,
      notebookId: persistedNotebookId,
      source: ingress.source,
      sourceMetadata: ingress.sourceMetadata,
      timestamp: new Date(),
    })

    // Save attachments if provided
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const attType = att.mime.startsWith("audio/") ? "audio"
          : att.mime.startsWith("image/") ? "image"
          : "document"
        await db.insert(messageAttachments).values({
          id: att.id,
          messageId: userMsgId,
          type: attType,
          name: att.name,
          mime: att.mime,
          size: att.size,
          url: att.url,
          transcription: att.transcription || null,
          durationMs: att.durationMs || null,
          createdAt: new Date(),
        })
      }
    }

    let routingMetadata: NotebookRoutingMetadata | null = null

    // If work task requested without a client, ask before adding to WorkOS
    if (action?.type === "create" && domain === "work" && !mentionedClient) {
      const assistantMsgId = randomUUID()
      const assistantContent = "Which client should I attach this work task to?"
      await db.insert(messages).values({
        id: assistantMsgId,
        sessionId,
        role: "assistant",
        content: assistantContent,
        notebookId: persistedNotebookId,
        source: "assistant",
        sourceMetadata: { replyToSource: ingress.source },
        timestamp: new Date(),
        taskCard: null,
      })
      await db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, sessionId))
      return NextResponse.json({
        sessionId,
        userMessage: { id: userMsgId, role: "user", content: message, notebookId: persistedNotebookId },
        assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent, taskCard: null },
        routingMetadata,
      })
    }

    // Fast-path: personal task actions via Todoist MCP
    if (action && (domain === "personal" || domain === "unknown")) {
      let result: { message: string }
      switch (action.type) {
        case "delete":
          result = await deleteTodoistTaskByQuery(action.query)
          break
        case "complete":
          result = await completeTodoistTaskByQuery(action.query)
          break
        case "update":
          result = await updateTodoistTaskByQuery(action.query, action.newContent)
          break
        case "create":
          result = await createTodoistTask(action.query)
          break
        default:
          result = { message: "I couldn't determine the task action." }
      }
      const assistantMsgId = randomUUID()
      const assistantContent = result.message
      await db.insert(messages).values({
        id: assistantMsgId,
        sessionId,
        role: "assistant",
        content: assistantContent,
        notebookId: persistedNotebookId,
        source: "assistant",
        sourceMetadata: { replyToSource: ingress.source },
        timestamp: new Date(),
        taskCard: null,
      })
      await db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, sessionId))
      return NextResponse.json({
        sessionId,
        userMessage: { id: userMsgId, role: "user", content: message, notebookId: persistedNotebookId },
        assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent, taskCard: null },
        routingMetadata,
      })
    }

    // Build attachment info for OpenClaw
    const attachmentInfo = attachments && attachments.length > 0
      ? "\n\n[Attachments: " + attachments.map(a => `${a.name} (${a.url})`).join(", ") + "]"
      : ""

    // Get conversation history
    const history = await db
      .select({
        role: messages.role,
        content: messages.content,
        timestamp: messages.timestamp,
        notebookId: messages.notebookId,
      })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.timestamp)) as HistoryMessage[]

    let avoidanceContext = ""
    try {
      avoidanceContext = await getAvoidanceSummary()
    } catch (err) {
      console.log("[chat] Failed to get avoidance context:", err)
    }

    const mergedContextResult = buildMergedContextBlock({
      history,
      latestUserMessage: message,
      avoidanceContext,
      routing: {
        mode: ragRouteMode,
        notebookId,
        candidateNotebookIds,
      },
    })
    const mergedContext = mergedContextResult.text
    routingMetadata = mergedContextResult.routing
    const forceDecompositionWorkflow = shouldForceDecompositionWorkflow({
      latestUserMessage: message,
      recentTurns: mergedContextResult.recentTurns,
      retrievedTurns: mergedContextResult.retrievedTurns,
    })
    const decompositionRagContext = buildDecompositionRagContext({
      latestUserMessage: message,
      recentTurns: mergedContextResult.recentTurns,
      retrievedTurns: mergedContextResult.retrievedTurns,
      routing: mergedContextResult.routing,
      maxChars: MAX_DECOMPOSITION_RAG_CONTEXT_CHARS,
    })
    const decompositionWorkflowInstruction = forceDecompositionWorkflow
      ? `\n\nMANDATORY DECOMPOSITION WORKFLOW
- This turn is planning/decomposition intent (or follow-up to it) based on merged and retrieved context.
- Before any generic guidance, call decompose_task exactly once.
- Use decompose_task args:
  - query: infer from latest user request and recent thread
  - rag_context: include the most relevant prior context for continuity
- After tool result, respond with the resulting subtasks and concise sequencing guidance.`
      : ""
    const enhancedPrompt = `${WORK_OS_PROMPT}\n\n${mergedContext}${decompositionWorkflowInstruction}`

    const conversationMessages: OpenAI.ChatCompletionMessageParam[] = history.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))

    // If there's an image, modify the last user message to include it
    if (imageBase64) {
      const lastIdx = conversationMessages.length - 1
      const lastMsg = conversationMessages[lastIdx]
      if (lastMsg && lastMsg.role === "user") {
        conversationMessages[lastIdx] = {
          role: "user",
          content: [
            { type: "text", text: message || "What's in this image?" },
            { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
          ],
        }
      }
    }

    // Build OpenAI messages
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: enhancedPrompt },
      ...conversationMessages,
    ]

    let assistantMessage: OpenAI.ChatCompletionMessage
    let taskCard = null
    let decompositionToolInvoked = false
    let forcedDecompositionContent: string | null = null

    const activityPreference =
      activityMode === "hide" || activityMode === false ? "hide" : "show"

    if (openclawEnabled) {
      if (!openclaw) {
        throw new Error("OpenClaw is enabled but OPENCLAW_URL/OPENCLAW_TOKEN are not set.")
      }

      const openclawModel = "openclaw:synapse"

      // Inject current task context for OpenClaw
      const taskContext = await getCurrentTaskContext()
      const activityRule = activityPreference === "show"
        ? "If you use tools, append an activity log block at the end in this exact format:\n\n[[ACTIVITY]]\n- tool_name: short summary of what happened\n[[/ACTIVITY]]"
        : "Do NOT include [[ACTIVITY]] blocks in your response."

      const workosContext = `${WORK_OS_PROMPT}\n\n${mergedContext}${decompositionWorkflowInstruction}\n\nACTIVITY LOG\n- ${activityRule}`
      const chatMessages = [...conversationMessages]

      // Append attachment info to last user message if present
      if (attachmentInfo && chatMessages.length > 0) {
        const lastIdx = chatMessages.length - 1
        const lastMsg = chatMessages[lastIdx]
        if (lastMsg.role === "user" && typeof lastMsg.content === "string") {
          chatMessages[lastIdx] = { ...lastMsg, content: lastMsg.content + attachmentInfo }
        }
      }

      const openclawMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: `${workosContext}\n\n${taskContext}` },
        ...chatMessages,
      ]

      console.log('[chat] OpenClaw request:', {
        url: `${openclawBaseUrl}/v1/chat/completions`,
        model: openclawModel,
        messageCount: openclawMessages.length,
        lastUserMessage: openclawMessages[openclawMessages.length - 1]?.content?.toString().slice(0, 100)
      })

      let response
      try {
        const clawConversation: OpenAI.ChatCompletionMessageParam[] = [...openclawMessages]

        response = await openclaw.chat.completions.create({
          model: openclawModel,
          messages: clawConversation,
          tools: chatTools,
          tool_choice: forceDecompositionWorkflow || requireToolCall ? "required" : "auto",
        })

        console.log('[chat] OpenClaw response:', {
          choices: response.choices?.length,
          firstChoice: response.choices?.[0]?.message?.content?.slice(0, 100),
          finishReason: response.choices?.[0]?.finish_reason,
          fullContent: response.choices?.[0]?.message?.content
        })

        if (!response.choices || response.choices.length === 0) {
          throw new Error("OpenClaw returned no choices in response")
        }

        assistantMessage = response.choices[0].message

        if (!assistantMessage) {
          throw new Error("OpenClaw returned empty message object")
        }

        if (!assistantMessage.content || !assistantMessage.content.trim()) {
          console.warn('[chat] OpenClaw returned empty content, response object:', JSON.stringify(response, null, 2))
        }

        // Check for heartbeat responses and convert them
        if (assistantMessage.content && assistantMessage.content.includes("HEARTBEAT_OK")) {
          console.warn('[chat] OpenClaw returned heartbeat response, converting to chat response')
          assistantMessage.content = "I'm here and ready to help! What can I assist you with today?"
        }

        // Handle tool calls (same pattern as OpenAI path)
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          clawConversation.push(assistantMessage)

          for (const toolCall of assistantMessage.tool_calls) {
            if (!("function" in toolCall)) continue
            const toolName = toolCall.function.name
            const toolArgsRaw = JSON.parse(toolCall.function.arguments)
            const toolArgs = typeof toolArgsRaw === "object" && toolArgsRaw !== null
              ? (toolArgsRaw as Record<string, unknown>)
              : {}
            const hydratedToolArgs =
              toolName === "decompose_task"
                ? {
                    ...toolArgs,
                    query: String(toolArgs.query || message).trim() || message,
                    rag_context: decompositionRagContext,
                  }
                : toolArgs

            console.log(`[chat] OpenClaw calling tool: ${toolName}`, hydratedToolArgs)

            const result = await executeTool(toolName, hydratedToolArgs)
            if (toolName === "decompose_task") {
              decompositionToolInvoked = true
            }

            if (toolName === "create_task" && (result as any)?.task) {
              const task = (result as any).task
              taskCard = {
                title: task.title,
                taskId: String(task.id),
                status: task.status,
              }
            }

            clawConversation.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            })
          }

          response = await openclaw.chat.completions.create({
            model: openclawModel,
            messages: clawConversation,
            tools: chatTools,
            tool_choice: "auto",
          })

          assistantMessage = response.choices[0].message
        }
      } catch (openclawError) {
        console.error('[chat] OpenClaw API error:', openclawError)
        console.error('[chat] OpenClaw request details:', {
          url: `${openclawBaseUrl}/v1/chat/completions`,
          messageCount: openclawMessages.length,
          tokenPresent: !!process.env.OPENCLAW_TOKEN
        })

        // Fallback to OpenAI if OpenClaw fails
        console.log('[chat] Falling back to OpenAI due to OpenClaw error')
        throw new Error(`OpenClaw request failed: ${openclawError instanceof Error ? openclawError.message : String(openclawError)}`)
      }
    } else {
      // Call OpenAI with tools
      let response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: openaiMessages,
        tools: chatTools,
        tool_choice: forceDecompositionWorkflow || requireToolCall ? "required" : "auto",
      })

      assistantMessage = response.choices[0].message

      // Handle tool calls
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        openaiMessages.push(assistantMessage)

        for (const toolCall of assistantMessage.tool_calls) {
          if (!("function" in toolCall)) continue
          const toolName = toolCall.function.name
          const toolArgsRaw = JSON.parse(toolCall.function.arguments)
          const toolArgs = typeof toolArgsRaw === "object" && toolArgsRaw !== null
            ? (toolArgsRaw as Record<string, unknown>)
            : {}
          const hydratedToolArgs =
            toolName === "decompose_task"
              ? {
                  ...toolArgs,
                  query: String(toolArgs.query || message).trim() || message,
                  rag_context: decompositionRagContext,
                }
              : toolArgs

          console.log(`Calling tool: ${toolName}`, hydratedToolArgs)

          const result = await executeTool(toolName, hydratedToolArgs)
          if (toolName === "decompose_task") {
            decompositionToolInvoked = true
          }

          // Create task card for task creation
          if (toolName === "create_task" && result.task) {
            taskCard = {
              title: result.task.title,
              taskId: String(result.task.id),
              status: result.task.status,
            }
          }

          openaiMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        }

        response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: openaiMessages,
          tools: chatTools,
          tool_choice: "auto",
        })

        assistantMessage = response.choices[0].message
      }
    }

    if (forceDecompositionWorkflow && !decompositionToolInvoked) {
      console.warn("[chat] Enforcing decomposition tool call because model skipped it")
      const forcedResult = await executeTool("decompose_task", {
        query: message,
        rag_context: decompositionRagContext,
      })
      forcedDecompositionContent = buildForcedDecompositionResponse(forcedResult)
    }

    // Save assistant message
    const assistantMsgId = randomUUID()
    let assistantContent = forcedDecompositionContent || assistantMessage.content || "Done."

    if (activityPreference === "hide") {
      assistantContent = stripActivity(assistantContent) || "Done."
    }

    console.log('[chat] Final assistant message:', {
      originalContent: assistantMessage.content,
      finalContent: assistantContent,
      contentLength: assistantContent?.length,
      taskCard: !!taskCard,
      openclawEnabled
    })

    // Check for suspicious content that might indicate an API issue
    if (assistantContent.includes("No response from OpenClaw") || assistantContent.includes("no response") || assistantContent.trim() === "") {
      console.error('[chat] Detected problematic response content:', {
        content: assistantContent,
        messageObject: JSON.stringify(assistantMessage, null, 2)
      })
    }

    await db.insert(messages).values({
      id: assistantMsgId,
      sessionId,
      role: "assistant",
      content: assistantContent,
      notebookId: persistedNotebookId,
      source: "assistant",
      sourceMetadata: { replyToSource: ingress.source },
      timestamp: new Date(),
      taskCard,
    })

    // Update session activity
    await db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, sessionId))

    return NextResponse.json({
      sessionId,
      userMessage: { id: userMsgId, role: "user", content: message, notebookId: persistedNotebookId },
      assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent, taskCard },
      routingMetadata,
    })
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chat failed" }, { status: 500 })
  }
}
