import { generateText } from "ai"
import { type NextRequest, NextResponse } from "next/server"

const SYSTEM_PROMPT = `
You are ThanosAI, a productivity coach specializing in breaking down work tasks.

Given a task, break it into 2-4 smaller, actionable subtasks that:
- Each start with a strong verb
- Are specific and measurable
- Can be completed in 15-30 minutes each
- Together fully complete the original task
- Are ordered logically

Rules:
- Return ONLY a JSON array of strings, nothing else
- Each subtask should be one clear sentence
- Keep the same context (client, project) as the original
- Don't add scope beyond the original task
`

export async function POST(request: NextRequest) {
  let body
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const { title, description, clientName, effortEstimate } = body

  if (!title) {
    return NextResponse.json({ error: "Title is required", subtasks: [] }, { status: 400 })
  }

  try {
    const userPrompt = `
Task: "${title}"
${description ? `Description: "${description}"` : ""}
${clientName ? `Client: ${clientName}` : ""}
Estimated effort: ${effortEstimate || 2} (1=Quick ~20min, 2=Standard ~40min, 3=Chunky ~60min, 4=Deep ~80+min)

Break this into smaller subtasks. Return only a JSON array of strings.
`
    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    })

    const cleanedText = result.text.trim().replace(/```json\n?|\n?```/g, "")
    const subtasks = JSON.parse(cleanedText)

    if (!Array.isArray(subtasks)) {
      throw new Error("Response is not an array")
    }

    return NextResponse.json({ subtasks })
  } catch (error) {
    console.error("[v0] Breakdown API error:", error)
    // Fallback subtasks if AI fails
    return NextResponse.json({
      subtasks: [
        `Review requirements for: ${title}`,
        `Complete main work on: ${title}`,
        `Review and finalize: ${title}`,
      ],
    })
  }
}
