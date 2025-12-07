import { generateText } from "ai"
import { NextResponse } from "next/server"

const SYSTEM_PROMPT = `
You are Synapse, a productivity coach.

Rewrite the user text as a single clear action that is:
- Specific
- Measurable
- Realistic for one work session
- Relevant to the client or project
- Time bound if a timebox is provided

Rules:
- Start with a verb
- Use at most 1 sentence
- Make it concrete enough that we can say "done" or "not done"
- Never add extra tasks or new ideas
- If the original is already clear and actionable, return it mostly unchanged
- If there is missing info, assume the minimal thing that makes sense instead of asking questions
`

type RewriteContext = {
  client?: string
  type?: string
  timebox_minutes?: number
}

export async function POST(request: Request) {
  const { text, context = {} } = (await request.json()) as {
    text: string
    context?: RewriteContext
  }

  try {
    const userPrompt = `
Original text:
"${text}"

Context:
${JSON.stringify(context, null, 2)}

Rewrite this as a SMART style work move, following the rules.
`

    const { text: rewrite } = await generateText({
      model: "openai/gpt-4o-mini",
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    })

    return NextResponse.json({ rewrite: rewrite.trim() })
  } catch (error) {
    console.error("Rewrite error:", error)
    return NextResponse.json({ rewrite: improveText(text, context) })
  }
}

// Fallback improvement logic if AI is unavailable
function improveText(text: string, context: RewriteContext): string {
  const client = context.client ? ` for ${context.client}` : ""
  const timebox = context.timebox_minutes ? ` in ${context.timebox_minutes} minutes` : ""

  // Add strong verb if missing
  const hasVerb =
    /^(Draft|Send|Review|Check|Update|Create|Write|Call|Meet|Email|Complete|Prepare|Analyze|Clear|Schedule|Finish)/i.test(
      text,
    )

  if (!hasVerb) {
    return `Complete ${text.toLowerCase()}${client}${timebox} and confirm done.`
  }

  return `${text}${client}${timebox} and confirm done.`
}
