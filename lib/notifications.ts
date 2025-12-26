// Notification service with ntfy.sh integration for progress milestones and summaries
import { DAILY_MINIMUM_MINUTES, DAILY_TARGET_MINUTES } from "@/lib/constants"

const NTFY_TOPIC = "Jeremys-Impressive-Work-Updates"
const NTFY_SERVER = "https://ntfy.sh"
const NTFY_URL = `${NTFY_SERVER}/${NTFY_TOPIC}`

interface NotificationOptions {
  title?: string
  tags?: string
  priority?: "min" | "low" | "default" | "high" | "urgent"
}

export async function sendNotification(message: string, options: NotificationOptions = {}) {
  const isPreview =
    typeof window !== "undefined"
      ? window.location.hostname.includes("vusercontent.net")
      : process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development"

  if (isPreview) {
    console.log("[Notification] Preview environment detected, returning mock success")
    return { success: true, preview: true, message: "Notification simulated in preview" }
  }

  const rawToken = process.env.NTFY_ACCESS_TOKEN

  if (!rawToken) {
    console.error("[Notification] NTFY_ACCESS_TOKEN not configured")
    return { success: false, error: "No access token configured" }
  }

  const accessToken = rawToken.trim().replace(/['"]/g, "")

  // Validate token format
  if (!accessToken.startsWith("tk_")) {
    console.error("[Notification] Token validation failed:", {
      startsWithTk: accessToken.startsWith("tk_"),
      firstChars: accessToken.substring(0, 5),
      length: accessToken.length,
    })
    return { success: false, error: "Invalid token format - must start with tk_" }
  }

  console.log("[Notification] Config:", {
    server: NTFY_SERVER,
    topic: NTFY_TOPIC,
    fullUrl: NTFY_URL,
    tokenPrefix: accessToken.substring(0, 5) + "...",
    tokenLength: accessToken.length,
    messageLength: message.length,
  })

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "text/plain; charset=utf-8",
    }

    if (options.title) {
      // Remove emojis from title (headers must be ASCII)
      headers["Title"] = options.title
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "")
        .trim()
    }
    if (options.tags) headers["Tags"] = options.tags
    if (options.priority) headers["Priority"] = options.priority

    console.log("[Notification] Request details:", {
      url: NTFY_URL,
      method: "POST",
      headers: Object.keys(headers),
      bodyLength: message.length,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(NTFY_URL, {
      method: "POST",
      headers,
      body: message,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()

    console.log("[Notification] Response:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      body: responseText.substring(0, 200),
    })

    if (!response.ok) {
      const error = `ntfy.sh returned ${response.status}: ${responseText}`
      console.error("[Notification] Error response:", error)

      if (response.status === 401) {
        console.error("[Notification] 401 Details:", {
          authHeader: `Bearer ${accessToken.substring(0, 10)}...`,
          tokenLength: accessToken.length,
        })
      }

      return { success: false, error }
    }

    console.log("[Notification] Successfully sent")
    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[Notification] Exception:", error)

    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Request timeout after 10 seconds" }
    }

    return { success: false, error: errorMsg }
  }
}

interface MilestoneAlertParams {
  percent: number
  taskCount: number
  earnedPoints: number
  targetPoints: number
  currentStreak: number
}

// Compact format: "4 tasks ✓ • 16/18 pts • 🔥 Day 3"
export async function sendMilestoneAlert({
  percent,
  taskCount,
  earnedPoints,
  targetPoints,
  currentStreak,
}: MilestoneAlertParams) {
  const hitGoal = earnedPoints >= targetPoints
  let priority: "min" | "low" | "default" | "high" | "urgent" = "default"

  // Build compact message parts
  const parts: string[] = []
  parts.push(`${taskCount} task${taskCount !== 1 ? "s" : ""} ✓`)
  parts.push(`${earnedPoints}/${targetPoints} pts`)

  // Add streak only if ≥2 days
  if (currentStreak >= 2) {
    parts.push(`🔥 Day ${currentStreak}`)
  }

  let message = parts.join(" • ")

  // Add celebratory prefix for milestones
  if (hitGoal || percent >= 100) {
    message = `🎯 ${message}`
    priority = "high"
  } else if (percent >= 75) {
    message = `🔥 ${message}`
  } else if (percent >= 50) {
    message = `⚡ ${message}`
  } else if (percent >= 25) {
    message = `🚀 ${message}`
  }

  // Special celebrations for exceeding target
  if (percent >= 150) {
    message = `🏆 ${parts.join(" • ")}`
    priority = "high"
  } else if (percent >= 125) {
    message = `🌟 ${parts.join(" • ")}`
    priority = "high"
  }

  return sendNotification(message, {
    title: "Work OS",
    tags: "chart_with_upwards_trend",
    priority,
  })
}

export function formatMorningSummary(stats: {
  weekTasks: number
  weekMinutes: number
  weekTarget: number
  bestDay: { day: string; tasks: number } | null
  worstDay: { day: string; tasks: number } | null
  staleClients: string[]
  deferredTasks?: Array<{ title: string; deferCount: number }>
}) {
  const pct = Math.round((stats.weekMinutes / stats.weekTarget) * 100)
  let msg = `☀️ Good morning!\n\n`
  msg += `📊 Week so far: ${stats.weekTasks} tasks (${stats.weekMinutes}/${stats.weekTarget} min = ${pct}%)\n\n`
  msg += `🎯 Today's goals:\n`
  msg += `   • Minimum: ${DAILY_MINIMUM_MINUTES} min (3 hours)\n`
  msg += `   • Target: ${DAILY_TARGET_MINUTES} min (4 hours)\n`

  if (stats.bestDay) {
    msg += `\n🏆 Best day: ${stats.bestDay.day} (${stats.bestDay.tasks} tasks)`
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
  todayTasks: number
  todayMinutes: number
  targetMinutes: number
  clientsTouched: string[]
  remainingActive: number
}) {
  const minimumMet = stats.todayMinutes >= DAILY_MINIMUM_MINUTES
  const targetMet = stats.todayMinutes >= DAILY_TARGET_MINUTES
  const percentOfTarget = Math.round((stats.todayMinutes / DAILY_TARGET_MINUTES) * 100)

  let msg = `🌤️ Afternoon Check-in\n\n`
  msg += `📊 Today: ${stats.todayMinutes} min earned (${stats.todayTasks} tasks) - ${percentOfTarget}%\n`

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

  msg += `\n📋 ${stats.remainingActive} active tasks remaining`

  return msg
}
