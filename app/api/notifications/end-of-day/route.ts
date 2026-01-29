import { NextResponse } from "next/server"
import { tasks, clients } from "@/lib/schema"
import { eq, and, gte } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"
import { getDb } from "@/lib/db" // Assuming getDb is a function to initialize db

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken) return true
  if (!authHeader) return false

  const token = authHeader.replace("Bearer ", "")
  return token === expectedToken
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get today's stats
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
    const todayStr = estNow.toISOString().split("T")[0]
    const todayStart = new Date(todayStr + "T00:00:00-05:00")

    const dbInstance = await getDb()
    const completedToday = await dbInstance
      .select({
        id: tasks.id,
        title: tasks.title,
        effortEstimate: tasks.effortEstimate,
        clientId: tasks.clientId,
        clientName: clients.name,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayStart)))

    const taskCount = completedToday.length
    const minutesEarned = completedToday.reduce((sum, t) => sum + (t.effortEstimate || 1) * 20, 0)
    const clientsTouched = new Set(completedToday.map((t) => t.clientName).filter(Boolean)).size
    const goalMinutes = 180
    const percentage = Math.round((minutesEarned / goalMinutes) * 100)

    let emoji = "🎉"
    let verdict = "Crushed it!"

    if (percentage < 50) {
      emoji = "😬"
      verdict = "Rough day - tomorrow is fresh."
    } else if (percentage < 75) {
      emoji = "📈"
      verdict = "Solid progress!"
    } else if (percentage < 100) {
      emoji = "💪"
      verdict = "Almost there!"
    }

    const allClients = await dbInstance.select().from(clients).where(eq(clients.isActive, 1))

    const touchedNames = new Set(completedToday.map((t) => t.clientName).filter(Boolean))
    const untouched = allClients.filter((c) => !touchedNames.has(c.name)).map((c) => c.name)

    let message = `${emoji} End of Day Report\n\n`
    message += `📊 ${taskCount} tasks | ${minutesEarned}/${goalMinutes} min (${percentage}%)\n`
    message += `👥 ${clientsTouched} clients touched\n\n`
    message += `${verdict}`

    if (untouched.length > 0 && untouched.length <= 3) {
      message += `\n\n⚠️ Didn't touch: ${untouched.join(", ")}`
    }

    await sendNotification(message, { title: "End of Day" })

    return NextResponse.json({
      sent: true,
      stats: { taskCount, minutesEarned, percentage, clientsTouched },
    })
  } catch (error) {
    console.error("End of day notification failed:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export const maxDuration = 60
