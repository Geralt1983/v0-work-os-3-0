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
    return { status: "error", message: "Couldn't access Todoist right now." }
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
    return { status: "error", message: "Couldn't access Todoist right now." }
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
    return { status: "error", message: "Couldn't access Todoist right now." }
  }
}

async function createTodoistTask(content: string): Promise<{status: "created" | "error", message: string}> {
  try {
    const created = await callTodoist("create_task", { content })
    const title = created?.content || content
    return { status: "created", message: `Done: added "${title}".` }
  } catch (err) {
    return { status: "error", message: "Couldn't access Todoist right now." }
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
    } = await request.json() as {
      sessionId?: string
      message: string
      imageBase64?: string
      attachments?: AttachmentInput[]
      activityMode?: "show" | "hide" | boolean
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

    // Save user message
    const userMsgId = randomUUID()
    await db.insert(messages).values({
      id: userMsgId,
      sessionId,
      role: "user",
      content: message,
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

    const activeClients = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.isActive, 1))
    const clientNames = activeClients.map((c) => c.name)
    const domain = classifyTaskDomain(message, clientNames)
    const action = extractTaskAction(message)
    const mentionedClient = findMentionedClient(message, clientNames)

    // If work task requested without a client, ask before adding to WorkOS
    if (action?.type === "create" && domain === "work" && !mentionedClient) {
      const assistantMsgId = randomUUID()
      const assistantContent = "Which client should I attach this work task to?"
      await db.insert(messages).values({
        id: assistantMsgId,
        sessionId,
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        taskCard: null,
      })
      await db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, sessionId))
      return NextResponse.json({
        sessionId,
        userMessage: { id: userMsgId, role: "user", content: message },
        assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent, taskCard: null },
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
        timestamp: new Date(),
        taskCard: null,
      })
      await db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, sessionId))
      return NextResponse.json({
        sessionId,
        userMessage: { id: userMsgId, role: "user", content: message },
        assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent, taskCard: null },
      })
    }

    // Build attachment info for OpenClaw
    const attachmentInfo = attachments && attachments.length > 0
      ? "\n\n[Attachments: " + attachments.map(a => `${a.name} (${a.url})`).join(", ") + "]"
      : ""

    // Get conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.timestamp))

    let avoidanceContext = ""
    try {
      avoidanceContext = await getAvoidanceSummary()
    } catch (err) {
      console.log("[chat] Failed to get avoidance context:", err)
    }

    const enhancedPrompt = avoidanceContext
      ? `${WORK_OS_PROMPT}\n\n## CURRENT AVOIDANCE AWARENESS\n${avoidanceContext}`
      : WORK_OS_PROMPT

    // Build OpenAI messages
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: enhancedPrompt },
      ...history.slice(-20).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ]

    // If there's an image, modify the last user message to include it
    if (imageBase64) {
      const lastMsg = openaiMessages[openaiMessages.length - 1]
      if (lastMsg && lastMsg.role === "user") {
        openaiMessages[openaiMessages.length - 1] = {
          role: "user",
          content: [
            { type: "text", text: message || "What's in this image?" },
            { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
          ],
        }
      }
    }

    let assistantMessage: OpenAI.ChatCompletionMessage
    let taskCard = null

    const activityPreference =
      activityMode === "hide" || activityMode === false ? "hide" : "show"

    if (openclawEnabled) {
      if (!openclaw) {
        throw new Error("OpenClaw is enabled but OPENCLAW_URL/OPENCLAW_TOKEN are not set.")
      }

      // Inject current task context for OpenClaw
      const taskContext = await getCurrentTaskContext()
      const workosContext = `WORKOS THANOSAI - Chat Interface

ROLE
- You are ThanosAI, a task-management chat assistant for WorkOS (work/client tasks only).

STYLE
- 1-2 sentences unless the user asks for more.
- No tool narration, no apologies, no blame.
- Ask at most ONE clarifying question if needed.
- If the user corrects you, acknowledge and comply without extra questions unless required to act.
- Do not mention internal file paths.

EXECUTION RULES
- WorkOS is for work/client tasks only.
- Personal tasks live in Todoist. Use Todoist MCP tools for personal tasks.
- Auto-classify work vs personal using client names and keywords.
- If a work task is requested without a client, ask which client before adding to WorkOS.
- Use MCP server "workos" for work/client tasks (tool names prefixed "workos.").
- Use MCP server "todoist" for personal tasks (tool names prefixed "todoist.").
- Do NOT mention Things.
- Only say you did something if you actually executed a tool.
- If the user says a task is personal or “get rid of/remove it”:
  - Use Todoist: find it (list_tasks with a filter), then delete_task.
  - Do NOT add personal tasks to WorkOS.
- If you cannot safely act, ask a single short question.

ACTIVITY LOG
- ${
        activityPreference === "show"
          ? "If you use tools, append an activity log block at the end in this exact format:\n\n[[ACTIVITY]]\n- tool_name: short summary of what happened\n[[/ACTIVITY]]"
          : "Do NOT include [[ACTIVITY]] blocks in your response."
      }

CONTEXT: You are ThanosAI, an AI assistant helping with task management in the WorkOS system.`
      
      // Pass through messages without modification (synapse workspace handles heartbeat override)
      const chatMessages = openaiMessages.slice(1)

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
        model: "openclaw:synapse",
        messageCount: openclawMessages.length,
        lastUserMessage: openclawMessages[openclawMessages.length - 1]?.content?.toString().slice(0, 100)
      })

      let response
      try {
        response = await openclaw.chat.completions.create({
          model: "openclaw:synapse",
          messages: openclawMessages,
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

      // OpenClaw handles tools natively; return its response directly
    } else {
      // Call OpenAI with tools
      let response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: openaiMessages,
        tools: chatTools,
        tool_choice: "auto",
      })

      assistantMessage = response.choices[0].message

      // Handle tool calls
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        openaiMessages.push(assistantMessage)

        for (const toolCall of assistantMessage.tool_calls) {
          if (!("function" in toolCall)) continue
          const toolName = toolCall.function.name
          const toolArgs = JSON.parse(toolCall.function.arguments)

          console.log(`Calling tool: ${toolName}`, toolArgs)

          const result = await executeTool(toolName, toolArgs)

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

    // Save assistant message
    const assistantMsgId = randomUUID()
    let assistantContent = assistantMessage.content || "Done."

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
      timestamp: new Date(),
      taskCard,
    })

    // Update session activity
    await db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, sessionId))

    return NextResponse.json({
      sessionId,
      userMessage: { id: userMsgId, role: "user", content: message },
      assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent, taskCard },
    })
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chat failed" }, { status: 500 })
  }
}
