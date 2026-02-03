import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sessions, messages } from "@/lib/schema"
import { eq, asc } from "drizzle-orm"
import { randomUUID } from "crypto"
import OpenAI from "openai"
import { WORK_OS_PROMPT } from "@/lib/ai/prompts"
import { chatTools } from "@/lib/ai/tools"
import { executeTool } from "@/lib/ai/tool-executor"
import { getAvoidanceSummary } from "@/lib/ai/avoidance"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const openclawBaseUrl = process.env.OPENCLAW_URL?.replace(/\/$/, "")
const openclaw = openclawBaseUrl
  ? new OpenAI({ apiKey: process.env.OPENCLAW_TOKEN, baseURL: `${openclawBaseUrl}/v1` })
  : null
const openclawEnabled = process.env.OPENCLAW_ENABLED === "true"

export async function POST(request: Request) {
  try {
    const db = getDb()
    const { sessionId: providedSessionId, message } = await request.json()

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

    let assistantMessage: OpenAI.ChatCompletionMessage
    let taskCard = null

    if (openclawEnabled) {
      if (!openclaw) {
        throw new Error("OpenClaw is enabled but OPENCLAW_URL/OPENCLAW_TOKEN are not set.")
      }

      const response = await openclaw.chat.completions.create({
        model: "openclaw:main",
        messages: openaiMessages,
      })

      assistantMessage = response.choices[0].message
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
