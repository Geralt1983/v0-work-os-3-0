// Notification service with ntfy.sh integration for progress milestones and summaries
import { DAILY_MINIMUM_MINUTES, DAILY_TARGET_MINUTES } from "@/lib/constants"

const TOPIC = "Jeremys-Impressive-Work-Updates"

interface NotificationOptions {
  title?: string
  tags?: string
  priority?: "min" | "low" | "default" | "high" | "urgent"
}

export async function sendNotification(message: string, options: NotificationOptions = {}) {
  const accessToken = process.env.NTFY_ACCESS_TOKEN
  const topic = process.env.NTFY_TOPIC || process.env.NEXT_PUBLIC_NTFY_TOPIC
  const server = process.env.NTFY_SERVER || process.env.NEXT_PUBLIC_NTFY_SERVER || "ntfy.sh"

  console.log("[Notification] Config:", {
    hasToken: !!accessToken,
    tokenLength: accessToken?.length,
    topic,
    server,
    messageLength: message.length,
  })

  if (!accessToken) {
    console.error("[Notification] NTFY_ACCESS_TOKEN not configured")
    return { success: false, error: "No access token configured" }
  }

  if (!topic) {
    console.error("[Notification] NTFY_TOPIC not configured")
    return { success: false, error: "No topic configured" }
  }

  try {
    const baseUrl = server.startsWith("http") ? server : `https://${server}`
    const url = new URL(topic, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`)

    // Add query parameters
    if (options.title) url.searchParams.set("title", options.title)
    if (options.tags) url.searchParams.set("tags", options.tags)
    if (options.priority) url.searchParams.set("priority", options.priority)

    console.log("[Notification] Sending to:", url.toString())

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    const response = await fetch(url.toString(), {
      method: "POST",
      body: message,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()
    console.log(`[Notification] Response: ${response.status} ${responseText.substring(0, 200)}`)

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        details: responseText.substring(0, 100),
      }
    }

    return { success: true }
  } catch (error) {
    console.error("[Notification] Exception:", error)
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { success: false, error: "Timeout after 15s" }
      }
      return { success: false, error: error.message }
    }
    return { success: false, error: String(error) }
  }
}

export async function sendMilestoneAlert(percent: number, movesCount: number, earnedMinutes?: number) {
  const minutes = earnedMinutes || 0
  const minimumMet = minutes >= DAILY_MINIMUM_MINUTES
  const targetMet = minutes >= DAILY_TARGET_MINUTES
  const toMinimum = Math.max(0, DAILY_MINIMUM_MINUTES - minutes)
  const toTarget = Math.max(0, DAILY_TARGET_MINUTES - minutes)

  let message: string
  let priority: "min" | "low" | "default" | "high" | "urgent" = "default"

  if (targetMet || percent >= 100) {
    message = `🎯 TARGET HIT! ${minutes} min earned (4 hour goal complete!)`
    priority = "high"
  } else if (minimumMet) {
    message = `✅ MINIMUM MET! ${minutes} min earned. ${toTarget} more for target.`
    priority = "high"
  } else if (percent >= 75) {
    message = `🔥 75% to target! ${minutes} min earned. ${toMinimum} to minimum, ${toTarget} to target.`
  } else if (percent >= 50) {
    message = `⚡ Halfway to target! ${minutes} min earned. ${toMinimum} to minimum.`
  } else if (percent >= 25) {
    message = `🚀 25% to target! ${minutes} min earned (${movesCount} moves). Keep going!`
  } else {
    message = `📊 Progress: ${minutes} min earned (${movesCount} moves).`
  }

  // Also check for exceeding target
  if (percent >= 150) {
    message = `🏆 150% - Legendary! ${minutes} min earned!`
    priority = "high"
  } else if (percent >= 125) {
    message = `🌟 125% - Above and beyond! ${minutes} min earned!`
    priority = "high"
  }

  return sendNotification(message, {
    title: "Work OS Update",
    tags: "tada,chart_with_upwards_trend",
    priority,
  })
}

export function formatMorningSummary(stats: {
  weekMoves: number
  weekMinutes: number
  weekTarget: number
  bestDay: { day: string; moves: number } | null
  worstDay: { day: string; moves: number } | null
  staleClients: string[]
  deferredTasks?: Array<{ title: string; deferCount: number }>
}) {
  const pct = Math.round((stats.weekMinutes / stats.weekTarget) * 100)
  let msg = `☀️ Good morning!\n\n`
  msg += `📊 Week so far: ${stats.weekMoves} moves (${stats.weekMinutes}/${stats.weekTarget} min = ${pct}%)\n\n`
  msg += `🎯 Today's goals:\n`
  msg += `   • Minimum: ${DAILY_MINIMUM_MINUTES} min (3 hours)\n`
  msg += `   • Target: ${DAILY_TARGET_MINUTES} min (4 hours)\n`

  if (stats.bestDay) {
    msg += `\n🏆 Best day: ${stats.bestDay.day} (${stats.bestDay.moves} moves)`
  }

  if (stats.staleClients.length > 0) {
    msg += `\n\n⚠️ STALE CLIENTS: ${stats.staleClients.join(", ")}`
    msg += `\n   → Touch these first today!`
  }

  if (stats.deferredTasks && stats.deferredTasks.length > 0) {
    const worst = stats.deferredTasks[0]
    msg += `\n\n🔄 DEFERRED ${worst.deferCount}x: "${worst.title}"`
    msg += `\n   → Do it, break it down, or delete it`
  }

  msg += `\n\nLet's get after it! 💪`

  return msg
}

export function formatAfternoonSummary(stats: {
  todayMoves: number
  todayMinutes: number
  targetMinutes: number
  clientsTouched: string[]
  remainingActive: number
}) {
  const minimumMet = stats.todayMinutes >= DAILY_MINIMUM_MINUTES
  const targetMet = stats.todayMinutes >= DAILY_TARGET_MINUTES
  const percentOfTarget = Math.round((stats.todayMinutes / DAILY_TARGET_MINUTES) * 100)

  let msg = `🌤️ Afternoon Check-in\n\n`
  msg += `📊 Today: ${stats.todayMinutes} min earned (${stats.todayMoves} moves) - ${percentOfTarget}%\n`

  if (targetMet) {
    msg += `🎯 TARGET HIT! You've crushed today.\n`
  } else if (minimumMet) {
    const remaining = DAILY_TARGET_MINUTES - stats.todayMinutes
    msg += `✅ Minimum met! ${remaining} min more for target.\n`
  } else {
    const toMinimum = DAILY_MINIMUM_MINUTES - stats.todayMinutes
    const toTarget = DAILY_TARGET_MINUTES - stats.todayMinutes
    msg += `⏳ ${toMinimum} min to minimum, ${toTarget} min to target\n`
  }

  if (stats.clientsTouched.length > 0) {
    msg += `\n✅ Touched: ${stats.clientsTouched.join(", ")}`
  }

  msg += `\n📋 ${stats.remainingActive} active moves remaining`

  return msg
}
