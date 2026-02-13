import { randomUUID } from "crypto"
import { and, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { messageAttachments, messages, notebooks, pendingIngestions, sessions } from "@/lib/schema"
import { resolveIngestionRoute, type IngestionSource, type SourceMetadata } from "@/lib/ai/ingestion-routing"

export type PendingIngestionStatus = "pending" | "confirmed" | "denied"

export type PendingIngestionAttachment = {
  id: string
  url: string
  name: string
  mime: string
  size: number
  durationMs?: number
  transcription?: string
}

export type CreatePendingIngestionInput = {
  source: IngestionSource
  content: string
  sourceMetadata?: SourceMetadata | null
  attachments?: PendingIngestionAttachment[] | null
  sessionId?: string | null
  notebookId?: string | null // optional explicit notebook key from upstream
}

const DEFAULT_INGESTION_SESSION_ID = "ingestion-inbox"

function titleCaseFromKey(key: string): string {
  return key
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function extractIngestionTitle(content: string, metadata?: SourceMetadata | null): string {
  const md = (metadata && typeof metadata === "object" ? metadata : {}) as SourceMetadata

  const candidates: Array<unknown> = [
    // Drive-ish metadata
    md.title,
    md.fileName,
    md.name,
    // Telegram-ish metadata
    md.caption,
    md.chatTitle,
    md.channelTitle,
  ]

  for (const cand of candidates) {
    if (typeof cand === "string") {
      const trimmed = cand.trim()
      if (trimmed) return trimmed.slice(0, 160)
    }
  }

  const cleaned = String(content || "")
    .replace(/\r/g, "")
    .trim()

  if (!cleaned) return "(empty)"

  const firstLine = cleaned.split("\n")[0]?.trim() || ""
  if (firstLine) return firstLine.slice(0, 160)

  return cleaned.slice(0, 160)
}

export async function createPendingIngestion(input: CreatePendingIngestionInput) {
  const db = getDb()

  const content = String(input.content || "").trim()
  if (!content) {
    throw new Error("content is required")
  }

  const ingress = resolveIngestionRoute({
    content,
    source: input.source,
    notebookId: input.notebookId,
    sourceMetadata: input.sourceMetadata,
  })

  const extractedTitle = extractIngestionTitle(content, input.sourceMetadata)
  const pendingId = randomUUID()
  const sessionId = (input.sessionId || "").trim() || DEFAULT_INGESTION_SESSION_ID
  const attachments = Array.isArray(input.attachments) ? input.attachments : []

  await db.insert(pendingIngestions).values({
    id: pendingId,
    status: "pending",
    source: ingress.source,
    sessionId,
    content,
    extractedTitle,
    suggestedNotebookId: ingress.notebookId,
    suggestedNotebookConfidence: String(ingress.routing.confidence),
    attachments,
    sourceMetadata: ingress.sourceMetadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return {
    id: pendingId,
    source: ingress.source,
    sessionId,
    content,
    extractedTitle,
    suggestedNotebookId: ingress.notebookId,
    suggestedNotebookConfidence: ingress.routing.confidence,
    routing: ingress.routing,
  }
}

export async function listPendingIngestions(options?: {
  status?: PendingIngestionStatus | PendingIngestionStatus[]
  limit?: number
  sources?: string[]
}) {
  const db = getDb()
  const limit = Math.max(1, Math.min(50, Number(options?.limit ?? 20)))
  const statusOpt = options?.status ?? "pending"
  const statuses = Array.isArray(statusOpt) ? statusOpt : [statusOpt]

  const whereClauses = [inArray(pendingIngestions.status, statuses)]
  if (options?.sources && options.sources.length > 0) {
    whereClauses.push(inArray(pendingIngestions.source, options.sources))
  }

  const rows = await db
    .select({
      id: pendingIngestions.id,
      status: pendingIngestions.status,
      source: pendingIngestions.source,
      extractedTitle: pendingIngestions.extractedTitle,
      suggestedNotebookId: pendingIngestions.suggestedNotebookId,
      suggestedNotebookConfidence: pendingIngestions.suggestedNotebookConfidence,
      finalNotebookId: pendingIngestions.finalNotebookId,
      createdAt: pendingIngestions.createdAt,
      decidedAt: pendingIngestions.decidedAt,
    })
    .from(pendingIngestions)
    .where(and(...whereClauses))
    .orderBy(desc(pendingIngestions.createdAt))
    .limit(limit)

  return rows
}

async function ensureSession(db: ReturnType<typeof getDb>, sessionId: string) {
  const existing = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  if (existing.length > 0) return
  await db.insert(sessions).values({ id: sessionId, createdAt: new Date(), lastActiveAt: new Date() })
}

async function ensureNotebookRegistryRow(db: ReturnType<typeof getDb>, notebookId: string) {
  if (!notebookId) return
  try {
    await db
      .insert(notebooks)
      .values({ id: notebookId, label: titleCaseFromKey(notebookId), createdAt: new Date() })
      .onConflictDoNothing()
  } catch {
    // Registry is a safety feature, not a hard dependency.
  }
}

export async function confirmPendingIngestion(args: { id: string; notebookId?: string; decisionReason?: string }) {
  const db = getDb()
  const id = String(args.id || "").trim()
  if (!id) return { success: false, error: "id is required" }

  const [row] = await db.select().from(pendingIngestions).where(eq(pendingIngestions.id, id)).limit(1)
  if (!row) return { success: false, error: `pending ingestion ${id} not found` }
  if (row.status !== "pending") {
    return { success: false, error: `pending ingestion ${id} is already ${row.status}` }
  }

  const finalNotebookId = String(args.notebookId || row.suggestedNotebookId || "general").trim() || "general"
  const sessionId = (row.sessionId || "").trim() || DEFAULT_INGESTION_SESSION_ID
  const decidedAt = new Date()

  await ensureSession(db, sessionId)
  await ensureNotebookRegistryRow(db, finalNotebookId)

  const userMsgId = randomUUID()
  await db.insert(messages).values({
    id: userMsgId,
    sessionId,
    role: "user",
    content: row.content,
    notebookId: finalNotebookId,
    source: row.source,
    sourceMetadata: (row.sourceMetadata || {}) as Record<string, unknown>,
    timestamp: decidedAt,
  })

  const attachments = Array.isArray(row.attachments) ? (row.attachments as PendingIngestionAttachment[]) : []
  for (const att of attachments) {
    const attType = att.mime?.startsWith("audio/") ? "audio" : att.mime?.startsWith("image/") ? "image" : "document"
    await db.insert(messageAttachments).values({
      id: att.id,
      messageId: userMsgId,
      type: attType,
      name: att.name,
      mime: att.mime,
      size: att.size,
      url: att.url,
      transcription: att.transcription || null,
      durationMs: att.durationMs || null,
      createdAt: decidedAt,
    })
  }

  await db
    .update(pendingIngestions)
    .set({
      status: "confirmed",
      finalNotebookId,
      decisionReason: args.decisionReason || null,
      decidedAt,
      updatedAt: decidedAt,
    })
    .where(eq(pendingIngestions.id, id))

  return { success: true, messageId: userMsgId, sessionId, notebookId: finalNotebookId }
}

export async function denyPendingIngestion(args: { id: string; decisionReason?: string }) {
  const db = getDb()
  const id = String(args.id || "").trim()
  if (!id) return { success: false, error: "id is required" }

  const [row] = await db.select().from(pendingIngestions).where(eq(pendingIngestions.id, id)).limit(1)
  if (!row) return { success: false, error: `pending ingestion ${id} not found` }
  if (row.status !== "pending") {
    return { success: false, error: `pending ingestion ${id} is already ${row.status}` }
  }

  const decidedAt = new Date()
  await db
    .update(pendingIngestions)
    .set({
      status: "denied",
      decisionReason: args.decisionReason || null,
      decidedAt,
      updatedAt: decidedAt,
    })
    .where(eq(pendingIngestions.id, id))

  return { success: true }
}
