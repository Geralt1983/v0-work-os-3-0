import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sessions, messages } from "@/lib/schema"
import { eq, asc } from "drizzle-orm"
import { randomUUID } from "crypto"
import OpenAI from "openai"
import { WORK_OS_PROMPT } from "@/lib/ai/prompts"
import { chatTools } from "@/lib/ai/tools"
import { executeTool } from "@/lib/ai/tool-executor"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const { sessionId: providedSessionId, message } = await request.json()

    // Get or create session
    let sessionId = providedSessionId
    if (!sessionId) {
      sessionId = randomUUID()
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

    // Build OpenAI messages
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: WORK_OS_PROMPT },
      ...history.slice(-20).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ]

    // Call OpenAI with tools
    let response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      tools: chatTools,
      tool_choice: "auto",
    })

    let assistantMessage = response.choices[0].message
    let taskCard = null

    // Handle tool calls
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      openaiMessages.push(assistantMessage)

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name
        const toolArgs = JSON.parse(toolCall.function.arguments)

        console.log(`Calling tool: ${toolName}`, toolArgs)

        const result = await executeTool(toolName, toolArgs)

        // Create task card for move creation
        if (toolName === "create_move" && result.move) {
          taskCard = {
            title: result.move.title,
            taskId: String(result.move.id),
            status: result.move.status,
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
