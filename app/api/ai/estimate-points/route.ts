import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

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

const POINTS_PROMPT = `You are a task points estimator for a healthcare operations consultant. Estimate the points value of tasks on a 1-10 scale based on time, cognitive load, and stakes.

POINTS SCALE:
1-2: Quick (<5 min) - forward email, check status, quick acknowledgment
3-4: Routine (15-30 min) - simple reply, small document review, standard update
5-6: Meaningful (30-60 min) - documentation, coordination across parties, research
7-8: Heavy lift (1-2 hours) - large order set review, complex issue resolution, training prep
9-10: Major (2+ hours, high stakes) - go-live support, escalation handling, critical decisions

TASK TO ANALYZE:
"{input}"

Respond in JSON format:
{
  "title": "Clean, actionable task title (imperative verb, specific)",
  "points": <number 1-10>,
  "reasoning": "Brief explanation of points estimate",
  "confidence": <number 0.0-1.0>
}

Rules for title cleanup:
- Start with action verb (Review, Send, Update, Complete, Schedule, etc.)
- Remove filler words and context that's obvious
- Keep client/project name if mentioned
- Be specific but concise (5-10 words ideal)`

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
          content: POINTS_PROMPT.replace("{input}", raw_input),
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

    return NextResponse.json({
      client: detectedClient,
      title: parsed.title,
      points: Math.min(10, Math.max(1, parsed.points)),
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
      raw_input,
    })
  } catch (error) {
    console.error("Points estimation error:", error)
    return NextResponse.json(
      { error: "Failed to estimate points" },
      { status: 500 }
    )
  }
}
