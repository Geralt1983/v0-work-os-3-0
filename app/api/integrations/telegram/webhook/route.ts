import { NextResponse } from "next/server"
import { createPendingIngestion } from "@/lib/ingestion/pending"
import {
  buildPendingIngestionInlineKeyboard,
  parseTelegramCallbackData,
  telegramAnswerCallbackQuery,
  telegramSendMessage,
} from "@/lib/telegram"
import { confirmPendingIngestion, denyPendingIngestion } from "@/lib/ingestion/pending"

type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

type TelegramChat = {
  id: number
  type?: string
  title?: string
}

type TelegramMessage = {
  message_id: number
  text?: string
  caption?: string
  from?: TelegramUser
  chat: TelegramChat
}

type TelegramCallbackQuery = {
  id: string
  data?: string
  from: TelegramUser
  message?: { message_id: number; chat: TelegramChat }
}

type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!expected) return true // allow if not configured
  const got = request.headers.get("x-telegram-bot-api-secret-token")?.trim()
  return Boolean(got && got === expected)
}

function formatSender(user?: TelegramUser): string {
  if (!user) return ""
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  if (name) return name
  return user.username ? `@${user.username}` : String(user.id)
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  let update: TelegramUpdate | null = null
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // Callback button: confirm/deny.
  if (update?.callback_query) {
    const cb = update.callback_query
    const parsed = parseTelegramCallbackData(cb.data)
    if (!parsed) {
      await telegramAnswerCallbackQuery(cb.id, "Unknown action.")
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    if (parsed.action === "confirm") {
      const result = await confirmPendingIngestion({ id: parsed.id, decisionReason: `telegram:${formatSender(cb.from)}` })
      await telegramAnswerCallbackQuery(cb.id, result.success ? "Confirmed." : "Failed.")
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const result = await denyPendingIngestion({ id: parsed.id, decisionReason: `telegram:${formatSender(cb.from)}` })
    await telegramAnswerCallbackQuery(cb.id, result.success ? "Denied." : "Failed.")
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // New inbound message: create pending ingestion + send approval message with buttons.
  if (update?.message) {
    const msg = update.message
    const content = (msg.text || msg.caption || "").trim()
    if (!content) return NextResponse.json({ ok: true }, { status: 200 })

    const pending = await createPendingIngestion({
      source: "telegram",
      content,
      sessionId: "ingestion-inbox",
      sourceMetadata: {
        chatId: msg.chat.id,
        chatType: msg.chat.type,
        chatTitle: msg.chat.title,
        messageId: msg.message_id,
        senderId: msg.from?.id,
        senderName: formatSender(msg.from),
      },
    })

    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || String(msg.chat.id)

    const text = [
      `Pending ingestion: ${pending.extractedTitle}`,
      `Source: telegram`,
      `Suggested notebook: ${pending.suggestedNotebookId} (${pending.suggestedNotebookConfidence.toFixed(2)})`,
      "",
      content.length > 800 ? content.slice(0, 800) + "..." : content,
    ].join("\n")

    await telegramSendMessage(adminChatId, text, {
      disableWebPagePreview: true,
      replyMarkup: buildPendingIngestionInlineKeyboard(pending.id),
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

