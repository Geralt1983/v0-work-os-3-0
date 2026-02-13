type HistoryLike = {
  role: string
  content: string
}

const DECOMPOSITION_INTENT_REGEX =
  /\b(break\s*(it|this|that)?\s*down|breakdown|decompose|subtasks?|step[-\s]?by[-\s]?step|plan\s+(this|that|it|my|the)|execution plan|implementation plan|roadmap)\b/i

const DECOMPOSITION_CONTEXT_REGEX =
  /\b(subtasks?|decompose|decomposition|step[-\s]?by[-\s]?step|execution plan|implementation plan|roadmap|next step)\b/i

const FOLLOW_UP_CONTINUATION_REGEX =
  /\b(yes|yep|yeah|do it|continue|go on|next|and then|for (this|that|it|the)|for the|that one|this one|expand|refine|make it smaller|more detail)\b/i

export function isDecompositionIntent(message: string): boolean {
  const text = String(message || "").trim()
  if (!text) return false
  return DECOMPOSITION_INTENT_REGEX.test(text)
}

export function shouldForceDecompositionWorkflow({
  latestUserMessage,
  recentTurns,
  retrievedTurns,
}: {
  latestUserMessage: string
  recentTurns: HistoryLike[]
  retrievedTurns: HistoryLike[]
}): boolean {
  const latest = String(latestUserMessage || "").trim()
  if (!latest) return false

  if (isDecompositionIntent(latest)) {
    return true
  }

  const combined = [...recentTurns, ...retrievedTurns]
  const hasPlanningContext = combined.some((turn) => DECOMPOSITION_CONTEXT_REGEX.test(turn.content || ""))
  const looksLikeFollowUp = FOLLOW_UP_CONTINUATION_REGEX.test(latest) || latest.split(/\s+/).length <= 7

  return hasPlanningContext && looksLikeFollowUp
}
