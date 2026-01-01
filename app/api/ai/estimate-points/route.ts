import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { VALUE_POINTS, type ValueTier } from "@/lib/domain/task-types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const CLIENT_PATTERNS: Record<string, string[]> = {
  "Raleigh": ["raleigh", "ral", "rdu"],
  "Orlando": ["orlando", "orl", "mcw"],
  "Memphis": ["memphis", "mem"],
  "Kentucky": ["kentucky", "ky", "louisville"],
  "Revenue": ["revenue", "rev", "billing", "invoice", "payment"],
  "General Admin": ["admin", "internal", "general", "misc"],
}

function detectClient(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [client, patterns] of Object.entries(CLIENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return client
      }
    }
  }
  return null
}

const VALUE_TIER_PROMPT = `You are a task value estimator for a healthcare operations consultant. Categorize tasks by the VALUE they produce, not time spent.

VALUE TIERS (choose ONE):

1. "checkbox" (1 point) - Had to happen, low stakes
   - Admin tasks: scheduling, email forwards, status checks
   - Quick acknowledgments, confirmations
   - Routine maintenance, filing

2. "progress" (2 points) - Moved something forward
   - Research, drafting, preparation work
   - Internal coordination, notes, updates
   - Incremental work on larger deliverables

3. "deliverable" (4 points) - Client sees output
   - Documents sent to client: specs, proposals, reports
   - Completed reviews with recommendations
   - Training materials or presentations delivered

4. "milestone" (7 points) - Major checkpoint
   - Go-live events, launches
   - Critical issue resolutions
   - Major project phase completions

TASK TO ANALYZE:
"{input}"

Respond in JSON format:
{
  "title": "Clean, actionable task title (imperative verb, specific)",
  "valueTier": "checkbox" | "progress" | "deliverable" | "milestone",
  "reasoning": "Brief explanation: what value does completing this produce?",
  "confidence": <number 0.0-1.0>
}

Rules for title cleanup:
- Start with action verb (Review, Send, Update, Complete, Schedule, etc.)
- Remove filler words and context that's obvious
- Keep client/project name if mentioned
- Be specific but concise (5-10 words ideal)

KEY QUESTION: "When this task is done, what VALUE exists that didn't before?"
- If nothing visible changes: checkbox
- If progress was made but nothing delivered: progress
- If client received something: deliverable
- If a major goal was achieved: milestone`

export async function POST(request: NextRequest) {
  try {
    const { raw_input, client_hint } = await request.json()

    if (!raw_input || typeof raw_input !== "string") {
      return NextResponse.json(
        { error: "raw_input is required" },
        { status: 400 }
      )
    }

    // Detect client from input or use hint
    const detectedClient = client_hint || detectClient(raw_input)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: VALUE_TIER_PROMPT.replace("{input}", raw_input),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 200,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    const parsed = JSON.parse(content)

    // Validate and normalize value tier
    const validTiers: ValueTier[] = ["checkbox", "progress", "deliverable", "milestone"]
    const valueTier: ValueTier = validTiers.includes(parsed.valueTier)
      ? parsed.valueTier
      : "progress" // Default to progress if invalid

    const points = VALUE_POINTS[valueTier]

    return NextResponse.json({
      client: detectedClient,
      title: parsed.title,
      valueTier,
      points,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
      raw_input,
      // Legacy compatibility
      pointsAiGuess: points,
    })
  } catch (error) {
    console.error("Value tier estimation error:", error)
    return NextResponse.json(
      { error: "Failed to estimate value tier" },
      { status: 500 }
    )
  }
}
