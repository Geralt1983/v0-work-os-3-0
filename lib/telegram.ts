type TelegramInlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
}

export type TelegramSendMessageOptions = {
  parseMode?: "Markdown" | "MarkdownV2" | "HTML"
  replyMarkup?: TelegramInlineKeyboard
  disableWebPagePreview?: boolean
}

function getTelegramBaseUrl() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return null
  return `https://api.telegram.org/bot${token}`
}

export async function telegramSendMessage(chatId: string, text: string, options?: TelegramSendMessageOptions) {
  const base = getTelegramBaseUrl()
  if (!base) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" }
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  }
  if (options?.parseMode) body.parse_mode = options.parseMode
  if (typeof options?.disableWebPagePreview === "boolean") body.disable_web_page_preview = options.disableWebPagePreview
  if (options?.replyMarkup) body.reply_markup = options.replyMarkup

  const res = await fetch(`${base}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: json?.description || `telegram sendMessage failed (${res.status})` }
  }
  return { ok: true, result: json?.result }
}

export async function telegramAnswerCallbackQuery(callbackQueryId: string, text?: string) {
  const base = getTelegramBaseUrl()
  if (!base) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" }
  }

  const body: Record<string, unknown> = { callback_query_id: callbackQueryId }
  if (text) body.text = text

  const res = await fetch(`${base}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: json?.description || `telegram answerCallbackQuery failed (${res.status})` }
  }
  return { ok: true }
}

export function buildPendingIngestionInlineKeyboard(pendingId: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "Confirm", callback_data: `ingest_confirm:${pendingId}` },
        { text: "Deny", callback_data: `ingest_deny:${pendingId}` },
      ],
    ],
  }
}

export function parseTelegramCallbackData(data: string | null | undefined):
  | { action: "confirm" | "deny"; id: string }
  | null {
  const raw = String(data || "").trim()
  const m = raw.match(/^ingest_(confirm|deny):(.+)$/)
  if (!m) return null
  const id = m[2]?.trim() || ""
  if (!id) return null
  return { action: m[1] === "confirm" ? "confirm" : "deny", id }
}
