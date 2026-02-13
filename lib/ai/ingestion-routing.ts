export type IngestionSource = "chat" | "google_drive" | "telegram" | "assistant"

export const DEFAULT_NOTEBOOK_ID = "general"
export const PERSONAL_NOTEBOOK_ID = "personal"
export const WORK_NOTEBOOK_ID = "work"

const WORK_HINTS = [
  "client",
  "clients",
  "project",
  "projects",
  "milestone",
  "milestones",
  "deliverable",
  "deliverables",
  "implementation",
  "rollout",
  "status",
  "backlog",
  "triage",
  "citrix",
  "ehr",
  "sow",
  "proposal",
]

const PERSONAL_HINTS = [
  "personal",
  "home",
  "family",
  "kids",
  "doctor",
  "dentist",
  "grocery",
  "shopping",
  "vacation",
  "trip",
  "todoist",
  "house",
]

export type SourceMetadata = Record<string, unknown>

export type IngestionRouteInput = {
  content: string
  source?: string | null
  notebookId?: string | null
  sourceMetadata?: SourceMetadata | null
}

export type ResolvedIngestionRoute = {
  notebookId: string
  source: IngestionSource
  sourceMetadata: SourceMetadata
  routing: {
    notebookId: string
    classifier: IngestionSource
    confidence: number
    explicit: boolean
    reason: string
  }
}

function compactWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

export function normalizeNotebookId(id?: string | null): string {
  const normalized = compactWhitespace(String(id || "").toLowerCase()).replace(/[^a-z0-9_-]+/g, "-")
  return normalized || DEFAULT_NOTEBOOK_ID
}

function normalizeSource(source?: string | null): IngestionSource {
  const normalized = compactWhitespace(String(source || "").toLowerCase())
  if (normalized === "telegram") return "telegram"
  if (normalized === "google_drive" || normalized === "gdrive" || normalized === "google-drive") return "google_drive"
  if (normalized === "assistant") return "assistant"
  return "chat"
}

function getHintScore(text: string, hints: string[]): number {
  return hints.reduce((count, hint) => count + (text.includes(hint) ? 1 : 0), 0)
}

export function classifyNotebookIdFromText(content: string): string {
  return classifyNotebookFromText(content).notebookId
}

export function classifyNotebookFromText(content: string): {
  notebookId: string
  confidence: number
  reason: string
} {
  const text = compactWhitespace(content.toLowerCase())
  if (!text) {
    return { notebookId: DEFAULT_NOTEBOOK_ID, confidence: 0.8, reason: "empty_default_general" }
  }

  const workHits = getHintScore(text, WORK_HINTS)
  const personalHits = getHintScore(text, PERSONAL_HINTS)
  const totalHits = workHits + personalHits

  if (totalHits === 0) {
    // We default to "general" when we have no signal, but treat this as reasonably safe.
    return { notebookId: DEFAULT_NOTEBOOK_ID, confidence: 0.8, reason: "no_hints_default_general" }
  }

  if (workHits === personalHits) {
    // Conflicting signal; don't pretend we're sure.
    return { notebookId: DEFAULT_NOTEBOOK_ID, confidence: 0.45, reason: "hint_tie_default_general" }
  }

  const notebookId = workHits > personalHits ? WORK_NOTEBOOK_ID : PERSONAL_NOTEBOOK_ID
  const diff = Math.abs(workHits - personalHits)
  const strength = diff / Math.max(totalHits, 1) // 0..1
  // Base confidence grows with total signal; strength boosts when it's not a close call.
  const base = Math.min(0.9, 0.55 + totalHits * 0.08)
  const confidence = Math.max(0, Math.min(0.99, base + strength * 0.25))

  return { notebookId, confidence, reason: notebookId === WORK_NOTEBOOK_ID ? "work_hints" : "personal_hints" }
}

function classifyTelegramNotebookId(content: string, metadata: SourceMetadata): string {
  return classifyTelegramNotebook(content, metadata).notebookId

}

function classifyTelegramNotebook(content: string, metadata: SourceMetadata): {
  notebookId: string
  confidence: number
  reason: string
} {
  const metadataNotebook = typeof metadata.notebookId === "string" ? metadata.notebookId : metadata.notebookKey
  if (typeof metadataNotebook === "string" && metadataNotebook.trim()) {
    return { notebookId: normalizeNotebookId(metadataNotebook), confidence: 0.99, reason: "metadata_notebook" }
  }

  const metadataText = compactWhitespace(
    [metadata.chatTitle, metadata.channelTitle, metadata.chatType, metadata.senderName, metadata.tags, metadata.topic]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  )

  const combined = compactWhitespace(`${content} ${metadataText}`)
  const classified = classifyNotebookFromText(combined)
  return { ...classified, reason: `telegram_${classified.reason}` }
}

function classifyGoogleDriveNotebookId(content: string, metadata: SourceMetadata): string {
  return classifyGoogleDriveNotebook(content, metadata).notebookId
}

function classifyGoogleDriveNotebook(content: string, metadata: SourceMetadata): {
  notebookId: string
  confidence: number
  reason: string
} {
  const metadataNotebook = typeof metadata.notebookId === "string" ? metadata.notebookId : metadata.notebookKey
  if (typeof metadataNotebook === "string" && metadataNotebook.trim()) {
    return { notebookId: normalizeNotebookId(metadataNotebook), confidence: 0.99, reason: "metadata_notebook" }
  }

  const metadataText = compactWhitespace(
    [metadata.fileName, metadata.title, metadata.path, metadata.folder, metadata.owner]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  )

  const combined = compactWhitespace(`${content} ${metadataText}`)
  const classified = classifyNotebookFromText(combined)
  return { ...classified, reason: `google_drive_${classified.reason}` }
}

export function resolveIngestionRoute(input: IngestionRouteInput): ResolvedIngestionRoute {
  const source = normalizeSource(input.source)
  const sourceMetadata = (input.sourceMetadata && typeof input.sourceMetadata === "object" ? input.sourceMetadata : {}) as SourceMetadata

  const explicitNotebookId = input.notebookId ? normalizeNotebookId(input.notebookId) : ""
  const classified =
    source === "telegram"
      ? classifyTelegramNotebook(input.content, sourceMetadata)
      : source === "google_drive"
        ? classifyGoogleDriveNotebook(input.content, sourceMetadata)
        : classifyNotebookFromText(input.content)

  const notebookId = explicitNotebookId || classified.notebookId
  const explicit = Boolean(explicitNotebookId)
  const confidence = explicit ? 1 : classified.confidence
  const reason = explicit ? "explicit_notebook" : classified.reason

  return {
    notebookId,
    source,
    sourceMetadata: {
      ...sourceMetadata,
      source,
      routing: {
        notebookId,
        classifier: source,
        confidence,
        explicit,
        reason,
      },
    },
    routing: {
      notebookId,
      classifier: source,
      confidence,
      explicit,
      reason,
    },
  }
}
