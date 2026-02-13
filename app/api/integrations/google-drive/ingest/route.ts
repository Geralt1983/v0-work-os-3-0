import { NextResponse } from "next/server"
import { createPendingIngestion } from "@/lib/ingestion/pending"
import { buildPendingIngestionInlineKeyboard, telegramSendMessage } from "@/lib/telegram"

function isAuthorized(request: Request): boolean {
  const expected = process.env.INGESTION_SECRET?.trim()
  if (!expected) return false
  const got = request.headers.get("authorization")?.trim()
  return got === `Bearer ${expected}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as
    | null
    | {
        content?: string
        title?: string
        fileName?: string
        url?: string
        path?: string
        folder?: string
        owner?: string
        notebookId?: string
        sourceMetadata?: Record<string, unknown>
      }

  const content = String(body?.content || "").trim()
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 })

  const pending = await createPendingIngestion({
    source: "google_drive",
    content,
    sessionId: "ingestion-inbox",
    notebookId: body?.notebookId || null,
    sourceMetadata: {
      ...(body?.sourceMetadata || {}),
      title: body?.title,
      fileName: body?.fileName,
      url: body?.url,
      path: body?.path,
      folder: body?.folder,
      owner: body?.owner,
    },
  })

  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()
  if (adminChatId) {
    const text = [
      `Pending ingestion: ${pending.extractedTitle}`,
      `Source: google_drive`,
      `Suggested notebook: ${pending.suggestedNotebookId} (${pending.suggestedNotebookConfidence.toFixed(2)})`,
      "",
      content.length > 800 ? content.slice(0, 800) + "..." : content,
    ].join("\n")

    await telegramSendMessage(adminChatId, text, {
      disableWebPagePreview: true,
      replyMarkup: buildPendingIngestionInlineKeyboard(pending.id),
    })
  }

  return NextResponse.json({ success: true, pending })
}

