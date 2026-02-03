import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sessions, messages, tasks, clients } from "@/lib/schema"
import { eq, asc, ne } from "drizzle-orm"
import { randomUUID } from "crypto"
import OpenAI from "openai"
import { WORK_OS_PROMPT } from "@/lib/ai/prompts"
import { chatTools } from "@/lib/ai/tools"
import { executeTool } from "@/lib/ai/tool-executor"
import { getAvoidanceSummary } from "@/lib/ai/avoidance"

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
  ? new OpenAI({ apiKey: process.env.OPENCLAW_TOKEN, baseURL: `${openclawBaseUrl}/v1` })
  : null
const openclawEnabled = process.env.OPENCLAW_ENABLED === "true"

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

const TOOL_RESULT_PREFIX = "TOOL_RESULT:"
const MAX_OPENCLAW_TOOL_LOOPS = 4

export async function POST(request: Request) {
  try {
    const db = getDb()
    const { sessionId: providedSessionId, message, imageBase64 } = await request.json()

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

    if (openclawEnabled) {
      if (!openclaw) {
        throw new Error("OpenClaw is enabled but OPENCLAW_URL/OPENCLAW_TOKEN are not set.")
      }

      // Inject current task context for OpenClaw with CRUD instructions
      const taskContext = await getCurrentTaskContext()
      const workosContext = `WORKOS SYNAPSE - Task Management (FULL CRUD)
CRITICAL: This is NOT a heartbeat. NEVER respond with HEARTBEAT_OK. Always respond conversationally.
Be BRIEF. No narration. Action-oriented.
Use the tools below to read/write tasks. Do NOT call external APIs or run shell commands.
When a tool executes, you will receive a message like:
${TOOL_RESULT_PREFIX} [{"tool":"create_task","result":{...}}]
Use that result to respond. Call another tool only if needed.`
      
      const openclawMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: `${workosContext}\n\n${getToolDocumentation()}\n\n${taskContext}` },
        ...openaiMessages.slice(1),
      ]

      let response = await openclaw.chat.completions.create({
        model: "openclaw:main",
        messages: openclawMessages,
      })

      assistantMessage = response.choices[0].message

      let toolCalls = assistantMessage.content ? parseToolCalls(assistantMessage.content) : null
      let toolLoopCount = 0

      while (toolCalls && toolLoopCount < MAX_OPENCLAW_TOOL_LOOPS) {
        openclawMessages.push({ role: "assistant", content: assistantMessage.content || "" })

        const toolResults: Array<{tool: string, args: Record<string, unknown>, result: unknown}> = []

        for (const toolCall of toolCalls) {
          try {
            const result = await executeTool(toolCall.tool, toolCall.args || {})

            if (toolCall.tool === "create_task" && (result as { task?: { title: string, id: number, status: string } }).task) {
              const createdTask = (result as { task: { title: string, id: number, status: string } }).task
              taskCard = {
                title: createdTask.title,
                taskId: String(createdTask.id),
                status: createdTask.status,
              }
            }

            toolResults.push({ tool: toolCall.tool, args: toolCall.args || {}, result })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            toolResults.push({ tool: toolCall.tool, args: toolCall.args || {}, result: { error: message } })
          }
        }

        openclawMessages.push({
          role: "user",
          content: `${TOOL_RESULT_PREFIX} ${JSON.stringify(toolResults)}`,
        })

        response = await openclaw.chat.completions.create({
          model: "openclaw:main",
          messages: openclawMessages,
        })

        assistantMessage = response.choices[0].message
        toolCalls = assistantMessage.content ? parseToolCalls(assistantMessage.content) : null
        toolLoopCount += 1
      }

      if (toolCalls && toolLoopCount >= MAX_OPENCLAW_TOOL_LOOPS) {
        console.warn("[chat] OpenClaw tool loop limit reached; returning last assistant message.")
      }
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
    const assistantContent = assistantMessage.content || "Done."

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
