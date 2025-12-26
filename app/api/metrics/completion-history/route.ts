import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, desc, gte, and } from "drizzle-orm"
import { getTaskPoints } from "@/lib/domain/task-types"

interface CompletedTask {
  id: number
  title: string
  completedAt: Date | null
  effortActual: number | null
  effortEstimate: number | null
  pointsFinal: number | null
  pointsAiGuess: number | null
  drainType: string | null
  clientId: number | null
  clientName: string | null
  clientColor: string | null
}

interface DayGroup {
  date: string
  displayLabel: string
  tasks: CompletedTask[]
  totalPoints: number
  uniqueClients: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daysBack = Number.parseInt(searchParams.get("days") || "30")
    const timezone = searchParams.get("timezone") || "America/New_York"

    const db = getDb()

    // Calculate date threshold
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)
    cutoffDate.setHours(0, 0, 0, 0)

    const completedTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        completedAt: tasks.completedAt,
        effortActual: tasks.effortActual,
        effortEstimate: tasks.effortEstimate,
        pointsFinal: tasks.pointsFinal,
        pointsAiGuess: tasks.pointsAiGuess,
        drainType: tasks.drainType,
        clientId: tasks.clientId,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, cutoffDate)))
      .orderBy(desc(tasks.completedAt))

    // Group by date in user's timezone
    const grouped = new Map<string, DayGroup>()

    const nowInTz = new Date().toLocaleString("en-US", { timeZone: timezone })
    const today = new Date(nowInTz)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Get date key from a timestamp in user's timezone
    const getTzDateKey = (date: Date) => {
      // Convert UTC timestamp to user's timezone
      const tzStr = date.toLocaleString("en-US", { timeZone: timezone })
      const tzDate = new Date(tzStr)

      const year = tzDate.getFullYear()
      const month = String(tzDate.getMonth() + 1).padStart(2, "0")
      const day = String(tzDate.getDate()).padStart(2, "0")
      return `${year}-${month}-${day}`
    }

    const todayKey = getTzDateKey(today)
    const yesterdayKey = getTzDateKey(yesterday)

    for (const task of completedTasks) {
      if (!task.completedAt) continue

      const dateKey = getTzDateKey(new Date(task.completedAt))

      // Determine display label
      let displayLabel: string
      if (dateKey === todayKey) {
        displayLabel = "Today"
      } else if (dateKey === yesterdayKey) {
        displayLabel = "Yesterday"
      } else {
        displayLabel = new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      }

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          date: dateKey,
          displayLabel,
          tasks: [],
          totalPoints: 0,
          uniqueClients: 0,
        })
      }

      const group = grouped.get(dateKey)!
      group.tasks.push(task)
      group.totalPoints += getTaskPoints(task)
    }

    // Calculate unique clients per day
    for (const group of grouped.values()) {
      const clientNames = new Set(group.tasks.map((t) => t.clientName).filter(Boolean))
      group.uniqueClients = clientNames.size
    }

    // Convert to array and sort by date descending
    const result = Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({
      days: result,
      timezone,
      totalDays: result.length,
    })
  } catch (error) {
    console.error("Failed to get completion history:", error)
    return NextResponse.json({ error: "Failed to get completion history" }, { status: 500 })
  }
}
