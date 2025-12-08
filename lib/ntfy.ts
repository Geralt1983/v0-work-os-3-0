// NTFY notification service for progress milestones and daily summaries

const NTFY_TOPIC = process.env.NTFY_TOPIC || "Jeremys-Impressive-Work-Updates"
const NTFY_SERVER = process.env.NTFY_SERVER || "https://ntfy.sh"

interface NotificationPayload {
  title: string
  message: string
  priority?: 1 | 2 | 3 | 4 | 5
  tags?: string[]
}

export async function sendNtfyNotification({ title, message, priority = 3, tags = [] }: NotificationPayload) {
  console.log("[v0] NTFY: Sending notification", { topic: NTFY_TOPIC, server: NTFY_SERVER, title, message })

  try {
    const response = await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        Title: title,
        Priority: String(priority),
        Tags: tags.join(","),
      },
      body: message,
    })

    console.log("[v0] NTFY: Response status", response.status)

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      console.error("[v0] NTFY: Failed to send notification:", response.status, errorText)
      return { success: false, error: response.statusText }
    }

    console.log("[v0] NTFY: Notification sent successfully")
    return { success: true }
  } catch (error) {
    console.error("[v0] NTFY: Error sending notification:", error)
    return { success: false, error: String(error) }
  }
}

// Milestone notifications
export function getMilestoneEmoji(percent: number): string {
  if (percent >= 150) return "rocket"
  if (percent >= 125) return "fire"
  if (percent >= 100) return "tada"
  if (percent >= 75) return "muscle"
  if (percent >= 50) return "running"
  return "coffee"
}

export function getMilestonePriority(percent: number): 1 | 2 | 3 | 4 | 5 {
  if (percent >= 100) return 4 // High priority for goal hit
  if (percent >= 75) return 3 // Default
  return 2 // Low for early milestones
}
