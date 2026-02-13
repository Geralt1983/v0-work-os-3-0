import {
  DEFAULT_NOTEBOOK_ID,
  classifyNotebookIdFromText,
  normalizeNotebookId,
} from "@/lib/ai/ingestion-routing"

export const RECENT_CONTEXT_TURNS = 10
export const RETRIEVED_CONTEXT_TURNS = 6
export const MAX_CONTEXT_CHARS = 220

export type HistoryLike = {
  role: string
  content: string
  notebookId?: string | null
}

export function compactWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

export function clipContext(input: string, max = MAX_CONTEXT_CHARS): string {
  const normalized = compactWhitespace(input)
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 3)}...`
}

export function tokenizeForRetrieval(input: string): Set<string> {
  const normalized = compactWhitespace(input.toLowerCase())
  const tokens = normalized.match(/[a-z0-9_]+/g) || []
  return new Set(tokens.filter((token) => token.length > 2))
}

export type NotebookRoutingMode = "auto" | "specific"

export type NotebookRoutingOptions = {
  mode?: NotebookRoutingMode
  notebookId?: string
  candidateNotebookIds?: string[]
}

export type NotebookScore = {
  notebookId: string
  score: number
  retrievedTurns: number
}

export type NotebookRoutingMetadata = {
  mode: NotebookRoutingMode
  requestedNotebookId: string | null
  candidateNotebookIds: string[]
  selectedNotebookIds: string[]
  notebookScores: NotebookScore[]
}

function scoreNotebookForTokens(history: HistoryLike[], query: string): number {
  if (history.length === 0) return 0
  const queryTokens = tokenizeForRetrieval(query)
  if (queryTokens.size === 0) return Math.min(0.2, history.length / 120)

  const joined = history.slice(-12).map((turn) => turn.content).join(" ")
  const tokens = tokenizeForRetrieval(joined)
  if (tokens.size === 0) return 0

  let overlap = 0
  for (const token of queryTokens) {
    if (tokens.has(token)) overlap += 1
  }

  return overlap / queryTokens.size
}

function inferNotebookId(turn: HistoryLike): string {
  const explicit = normalizeNotebookId(turn.notebookId)
  if (explicit !== DEFAULT_NOTEBOOK_ID || turn.notebookId) return explicit

  return classifyNotebookIdFromText(turn.content)
}

function buildNotebookStores(history: HistoryLike[]): Map<string, HistoryLike[]> {
  const stores = new Map<string, HistoryLike[]>()

  for (const turn of history) {
    const notebookId = inferNotebookId(turn)
    const existing = stores.get(notebookId)
    if (existing) {
      existing.push(turn)
    } else {
      stores.set(notebookId, [turn])
    }
  }

  return stores
}

export function pickRetrievedHistory(history: HistoryLike[], query: string): HistoryLike[] {
  if (history.length === 0) return []
  const queryTokens = tokenizeForRetrieval(query)
  if (queryTokens.size === 0) {
    // Enforce retrieval even for terse follow-ups ("do it", "next", etc.).
    return history.slice(Math.max(0, history.length - RETRIEVED_CONTEXT_TURNS))
  }

  const topMatches = history
    .map((msg, idx) => {
      const msgTokens = tokenizeForRetrieval(msg.content)
      if (msgTokens.size === 0) return { idx, score: 0 }

      let overlap = 0
      for (const token of queryTokens) {
        if (msgTokens.has(token)) overlap += 1
      }

      // Favor higher lexical overlap, with slight recency weighting.
      const lexicalScore = overlap / Math.max(queryTokens.size, 1)
      const recencyBoost = ((idx + 1) / history.length) * 0.05
      return { idx, score: lexicalScore + recencyBoost }
    })
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, RETRIEVED_CONTEXT_TURNS)

  if (topMatches.length === 0) {
    return history.slice(Math.max(0, history.length - RETRIEVED_CONTEXT_TURNS))
  }

  const expandedIndexes = new Set<number>()
  for (const item of topMatches) {
    expandedIndexes.add(item.idx)
    const prev = item.idx - 1
    const next = item.idx + 1
    if (prev >= 0) expandedIndexes.add(prev)
    if (next < history.length) expandedIndexes.add(next)
  }

  const selected = [...expandedIndexes]
    .sort((a, b) => a - b)
    .slice(Math.max(0, expandedIndexes.size - RETRIEVED_CONTEXT_TURNS))

  return selected.map((idx) => history[idx])
}

function scoreNotebookForQuery(history: HistoryLike[], query: string): number {
  return scoreNotebookForTokens(history, query)
}

function resolveNotebookRouting({
  stores,
  latestUserMessage,
  retrievalQuery,
  options,
}: {
  stores: Map<string, HistoryLike[]>
  latestUserMessage: string
  retrievalQuery: string
  options?: NotebookRoutingOptions
}): NotebookRoutingMetadata {
  const allNotebookIds = [...stores.keys()]
  const requestedNotebookId = options?.notebookId ? normalizeNotebookId(options.notebookId) : null
  const mode: NotebookRoutingMode = requestedNotebookId || options?.mode === "specific" ? "specific" : "auto"

  if (allNotebookIds.length === 0) {
    return {
      mode,
      requestedNotebookId,
      candidateNotebookIds: requestedNotebookId ? [requestedNotebookId] : [DEFAULT_NOTEBOOK_ID],
      selectedNotebookIds: requestedNotebookId ? [requestedNotebookId] : [DEFAULT_NOTEBOOK_ID],
      notebookScores: [],
    }
  }

  const requestedCandidates = (options?.candidateNotebookIds || [])
    .map((id) => normalizeNotebookId(id))
    .filter(Boolean)
  const candidateNotebookIds =
    mode === "specific" && requestedNotebookId
      ? [requestedNotebookId]
      : requestedCandidates.length > 0
        ? requestedCandidates
        : allNotebookIds

  const uniqueCandidates = [...new Set(candidateNotebookIds)]
  const scored: NotebookScore[] = uniqueCandidates.map((notebookId) => {
    const notebookHistory = stores.get(notebookId) || []
    const latestScore = scoreNotebookForQuery(notebookHistory, latestUserMessage)
    const retrievalScore = scoreNotebookForQuery(notebookHistory, retrievalQuery || latestUserMessage)
    const inferredNotebook = classifyNotebookIdFromText(latestUserMessage)
    const classifierBoost = inferredNotebook === notebookId ? 0.25 : 0
    const density = Math.min(0.1, notebookHistory.length / 100)
    return {
      notebookId,
      score: latestScore * 0.8 + retrievalScore * 0.2 + classifierBoost + density,
      retrievedTurns: notebookHistory.length,
    }
  })

  if (mode === "specific" && requestedNotebookId) {
    return {
      mode,
      requestedNotebookId,
      candidateNotebookIds: uniqueCandidates,
      selectedNotebookIds: [requestedNotebookId],
      notebookScores: scored,
    }
  }

  const selectedNotebookIds = scored
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0.02)
    .slice(0, 3)
    .map((item) => item.notebookId)

  const fallback = selectedNotebookIds.length > 0 ? selectedNotebookIds : [scored[0]?.notebookId || DEFAULT_NOTEBOOK_ID]

  return {
    mode,
    requestedNotebookId,
    candidateNotebookIds: uniqueCandidates,
    selectedNotebookIds: fallback,
    notebookScores: scored,
  }
}

export function buildMergedContextBlock({
  history,
  latestUserMessage,
  avoidanceContext,
  routing,
}: {
  history: HistoryLike[]
  latestUserMessage: string
  avoidanceContext: string
  routing?: NotebookRoutingOptions
}): { text: string; recentTurns: HistoryLike[]; retrievedTurns: HistoryLike[]; routing: NotebookRoutingMetadata } {
  const lines: string[] = ["## MERGED CONTEXT"]
  const stores = buildNotebookStores(history)
  const recentTurns = history.slice(-RECENT_CONTEXT_TURNS)

  const recentUserText = recentTurns
    .filter((turn) => turn.role === "user")
    .slice(-3)
    .map((turn) => turn.content)
    .join(" ")
  const retrievalQuery = `${latestUserMessage} ${recentUserText}`.trim()

  const routingMetadata = resolveNotebookRouting({
    stores,
    latestUserMessage,
    retrievalQuery,
    options: routing,
  })

  const retrieved: HistoryLike[] = []
  for (const notebookId of routingMetadata.selectedNotebookIds) {
    const notebookHistory = stores.get(notebookId) || []
    const recentFromNotebook = notebookHistory.slice(-RECENT_CONTEXT_TURNS)
    const olderFromNotebook = notebookHistory.slice(0, Math.max(0, notebookHistory.length - recentFromNotebook.length))
    const notebookRetrieved = pickRetrievedHistory(olderFromNotebook, retrievalQuery)
    retrieved.push(...notebookRetrieved)
  }

  const lastAssistantQuestion = [...history]
    .reverse()
    .find((turn) => turn.role === "assistant" && /\?\s*$/.test(turn.content))

  lines.push(
    `Routing metadata: mode=${routingMetadata.mode}; selected=${routingMetadata.selectedNotebookIds.join(", ")}; candidates=${routingMetadata.candidateNotebookIds.join(", ")}`,
  )

  if (lastAssistantQuestion) {
    lines.push(`Last assistant question: ${clipContext(lastAssistantQuestion.content, 300)}`)
  }

  lines.push("Recent conversation:")
  for (const turn of recentTurns) {
    if (!turn.content) continue
    lines.push(`- ${turn.role}: ${clipContext(turn.content)}`)
  }

  if (retrieved.length > 0) {
    lines.push("Retrieved prior context:")
    for (const turn of retrieved) {
      lines.push(`- ${turn.role}: ${clipContext(turn.content)}`)
    }
  }

  if (avoidanceContext) {
    lines.push("Avoidance context:")
    lines.push(clipContext(avoidanceContext, 1200))
  }

  return { text: lines.join("\n"), recentTurns, retrievedTurns: retrieved, routing: routingMetadata }
}

export function buildDecompositionRagContext({
  latestUserMessage,
  recentTurns,
  retrievedTurns,
  routing,
  maxChars = 2200,
}: {
  latestUserMessage: string
  recentTurns: HistoryLike[]
  retrievedTurns: HistoryLike[]
  routing: NotebookRoutingMetadata
  maxChars?: number
}): string {
  const lines: string[] = []
  lines.push("DECOMPOSITION RAG CONTEXT")
  lines.push(`Latest request: ${clipContext(latestUserMessage, 400)}`)
  lines.push(`Selected notebooks: ${routing.selectedNotebookIds.join(", ") || DEFAULT_NOTEBOOK_ID}`)

  if (recentTurns.length > 0) {
    lines.push("Recent thread context:")
    for (const turn of recentTurns.slice(-8)) {
      lines.push(`- ${turn.role}: ${clipContext(turn.content, 240)}`)
    }
  }

  if (retrievedTurns.length > 0) {
    lines.push("Retrieved notebook context:")
    for (const turn of retrievedTurns) {
      lines.push(`- ${turn.role}: ${clipContext(turn.content, 260)}`)
    }
  }

  return clipContext(lines.join("\n"), maxChars)
}
