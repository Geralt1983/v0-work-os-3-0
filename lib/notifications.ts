// Notification service with ntfy.sh integration for progress milestones and summaries

const TOPIC = "Jeremys-Impressive-Work-Updates"

interface NotificationOptions {
  title?: string
  tags?: string
  priority?: "min" | "low" | "default" | "high" | "urgent"
}

export async function sendNotification(message: string, options: NotificationOptions = {}) {
  const accessToken = process.env.NTFY_ACCESS_TOKEN

  console.log("[Notification] Attempting to send:", { message, options, hasToken: !!accessToken })

  if (!accessToken) {
    console.error("[Notification] NTFY_ACCESS_TOKEN not configured")
    return { success: false, error: "No access token" }
  }

  try {
    const url = new URL(`https://ntfy.sh/${TOPIC}`)
    url.searchParams.set("title", options.title || "Work OS")
    url.searchParams.set("tags", options.tags || "briefcase")
    url.searchParams.set("priority", options.priority || "default")

    const response = await fetch(url.toString(), {
      method: "POST",
      body: message,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
    })

    const responseText = await response.text()
    console.log(`[Notification] HTTP ${response.status}: ${responseText || "(empty)"}`)

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    console.error("[Notification] Error:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function sendMilestoneAlert(percent: number, movesCount: number) {
  const messages: Record<number, string> = {
    25: `🚀 25% Complete (${movesCount} moves)`,
    50: `🔥 50% Done. Halfway there!`,
    75: `😤 75% Done. Crushing it.`,
    100: `✅ 100% FINISHED. Day complete!`,
    125: `🌟 125% - Above and beyond!`,
    150: `🏆 150% - Legendary performance!`,
  }

  const message = messages[percent]
  if (!message) return { success: false, error: "Invalid milestone" }

  return sendNotification(message, {
    title: "Work OS Update",
    tags: "tada,chart_with_upwards_trend",
    priority: percent >= 100 ? "high" : "default",
  })
}

export function formatMorningSummary(stats: {
  weekMoves: number
  weekMinutes: number
  weekTarget: number
  bestDay: { day: string; moves: number } | null
  worstDay: { day: string; moves: number } | null
  staleClients: string[]
}) {
  const pct = Math.round((stats.weekMinutes / stats.weekTarget) * 100)
  let msg = `📊 Week So Far: ${stats.weekMoves} moves (${stats.weekMinutes}/${stats.weekTarget} min = ${pct}%)\n`

  if (stats.bestDay) {
    msg += `🏆 Best: ${stats.bestDay.day} (${stats.bestDay.moves} moves)\n`
  }
  if (stats.worstDay) {
    msg += `📉 Lowest: ${stats.worstDay.day} (${stats.worstDay.moves} moves)\n`
  }
  if (stats.staleClients.length > 0) {
    msg += `⚠️ Stale: ${stats.staleClients.join(", ")}`
  }

  return msg
}

export function formatAfternoonSummary(stats: {
  todayMoves: number
  todayMinutes: number
  targetMinutes: number
  clientsTouched: string[]
  remainingActive: number
}) {
  const pct = Math.round((stats.todayMinutes / stats.targetMinutes) * 100)
  let msg = `⏰ Day So Far: ${stats.todayMoves} moves (${pct}%)\n`
  msg += `📈 ${stats.todayMinutes}/${stats.targetMinutes} min earned\n`

  if (stats.clientsTouched.length > 0) {
    msg += `✅ Touched: ${stats.clientsTouched.join(", ")}\n`
  }

  msg += `📋 ${stats.remainingActive} active moves remaining`

  return msg
}
