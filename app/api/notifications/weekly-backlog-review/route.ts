import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients, clientMemory } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { sendNotification } from "@/lib/notifications"

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
    const db = await getDb()
    const backlogTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        createdAt: tasks.createdAt,
        backlogEnteredAt: tasks.backlogEnteredAt,
        clientName: clients.name,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(eq(tasks.status, "backlog"))

    const now = Date.now()
    const aged = backlogTasks.map((t) => {
      const created = new Date(t.backlogEnteredAt || t.createdAt).getTime()
      const daysOld = Math.floor((now - created) / (1000 * 60 * 60 * 24))
      return { ...t, daysOld }
    })

    const critical = aged.filter((t) => t.daysOld >= 21)
    const stale = aged.filter((t) => t.daysOld >= 14 && t.daysOld < 21)
    const aging = aged.filter((t) => t.daysOld >= 7 && t.daysOld < 14)

    const memories = await db.select().from(clientMemory)
    const staleClients = memories.filter((m) => (m.staleDays || 0) >= 3)

    let message = `📋 Weekly Backlog Review\n\n`
    message += `📦 Total backlog: ${backlogTasks.length} tasks\n\n`

    if (critical.length > 0) {
      message += `🔴 CRITICAL (21+ days): ${critical.length}\n`
      critical.slice(0, 3).forEach((t) => {
        message += `  • ${t.title.substring(0, 30)}... (${t.daysOld}d)\n`
      })
      message += "\n"
    }

    if (stale.length > 0) {
      message += `🟠 Stale (14-20 days): ${stale.length}\n`
    }

    if (aging.length > 0) {
      message += `🟡 Aging (7-13 days): ${aging.length}\n`
    }

    if (staleClients.length > 0) {
      message += `\n👥 Stale clients: ${staleClients.map((c) => `${c.clientName} (${c.staleDays}d)`).join(", ")}`
    }

    message += `\n\n🗡️ Time to keep or kill!`

    await sendNotification(message, { title: "Weekly Review" })

    return NextResponse.json({
      sent: true,
      stats: {
        total: backlogTasks.length,
        critical: critical.length,
        stale: stale.length,
        aging: aging.length,
        staleClients: staleClients.length,
      },
    })
  } catch (error) {
    console.error("Weekly review failed:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export const maxDuration = 60
