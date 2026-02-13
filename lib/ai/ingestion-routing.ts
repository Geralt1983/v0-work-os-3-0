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
  const text = compactWhitespace(content.toLowerCase())
  if (!text) return DEFAULT_NOTEBOOK_ID

  const workHits = getHintScore(text, WORK_HINTS)
  const personalHits = getHintScore(text, PERSONAL_HINTS)

  if (workHits > personalHits && workHits > 0) return WORK_NOTEBOOK_ID
  if (personalHits > workHits && personalHits > 0) return PERSONAL_NOTEBOOK_ID
  return DEFAULT_NOTEBOOK_ID
}

function classifyTelegramNotebookId(content: string, metadata: SourceMetadata): string {
  const metadataNotebook = typeof metadata.notebookId === "string" ? metadata.notebookId : metadata.notebookKey
  if (typeof metadataNotebook === "string" && metadataNotebook.trim()) {
    return normalizeNotebookId(metadataNotebook)
  }

  const metadataText = compactWhitespace(
    [
      metadata.chatTitle,
      metadata.channelTitle,
      metadata.chatType,
      metadata.senderName,
      metadata.tags,
      metadata.topic,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  )

  const combined = compactWhitespace(`${content} ${metadataText}`)
  return classifyNotebookIdFromText(combined)
}

function classifyGoogleDriveNotebookId(content: string, metadata: SourceMetadata): string {
  const metadataNotebook = typeof metadata.notebookId === "string" ? metadata.notebookId : metadata.notebookKey
  if (typeof metadataNotebook === "string" && metadataNotebook.trim()) {
    return normalizeNotebookId(metadataNotebook)
  }

  const metadataText = compactWhitespace(
    [metadata.fileName, metadata.title, metadata.path, metadata.folder, metadata.owner]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  )

  const combined = compactWhitespace(`${content} ${metadataText}`)
  return classifyNotebookIdFromText(combined)
}

export function resolveIngestionRoute(input: IngestionRouteInput): ResolvedIngestionRoute {
  const source = normalizeSource(input.source)
  const sourceMetadata = (input.sourceMetadata && typeof input.sourceMetadata === "object" ? input.sourceMetadata : {}) as SourceMetadata

  const explicitNotebookId = input.notebookId ? normalizeNotebookId(input.notebookId) : ""
  const classifiedNotebookId =
    source === "telegram"
      ? classifyTelegramNotebookId(input.content, sourceMetadata)
      : source === "google_drive"
        ? classifyGoogleDriveNotebookId(input.content, sourceMetadata)
        : classifyNotebookIdFromText(input.content)

  const notebookId = explicitNotebookId || classifiedNotebookId

  return {
    notebookId,
    source,
    sourceMetadata: {
      ...sourceMetadata,
      source,
      routing: {
        notebookId,
        classifier: source,
      },
    },
  }
}
