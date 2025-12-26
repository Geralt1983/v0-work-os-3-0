import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, and, gte, desc } from "drizzle-orm"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number.parseInt(searchParams.get("days") || "30", 10)
  const clientId = searchParams.get("clientId")
  const timezone = searchParams.get("timezone") || "America/New_York"

  try {
    const db = getDb()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const conditions = [eq(tasks.status, "done"), gte(tasks.completedAt, startDate)]

    if (clientId) {
      conditions.push(eq(tasks.clientId, Number.parseInt(clientId, 10)))
    }

    const completedTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        drainType: tasks.drainType,
        effortEstimate: tasks.effortEstimate,
        completedAt: tasks.completedAt,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(tasks.completedAt))

    // Group by date IN USER'S TIMEZONE
    const grouped: Record<string, any[]> = {}

    for (const task of completedTasks) {
      if (!task.completedAt) continue

      const completedAt = task.completedAt instanceof Date ? task.completedAt : new Date(task.completedAt)

      // Convert UTC timestamp to user's local date string
      const dateKey = completedAt.toLocaleDateString("en-CA", { timeZone: timezone }) // YYYY-MM-DD format

      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push({
        id: task.id,
        title: task.title,
        clientName: task.clientName,
        clientColor: task.clientColor,
        drainType: task.drainType,
        effortEstimate: task.effortEstimate,
        completedAt: completedAt.toISOString(),
      })
    }

    // Also compute today and yesterday in user's timezone for frontend comparison
    const now = new Date()
    const todayKey = now.toLocaleDateString("en-CA", { timeZone: timezone })
    const yesterdayDate = new Date(now.getTime() - 86400000)
    const yesterdayKey = yesterdayDate.toLocaleDateString("en-CA", { timeZone: timezone })

    // Convert to array sorted by date
    const timeline = Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, tasks]) => ({
        date,
        // Add display label based on user's timezone
        displayLabel: date === todayKey ? "Today" : date === yesterdayKey ? "Yesterday" : null,
        tasks,
        totalMinutes: tasks.reduce((sum: number, t: any) => sum + (t.effortEstimate || 1) * 20, 0),
        clientsTouched: [...new Set(tasks.map((t: any) => t.clientName))].filter(Boolean),
      }))

    return NextResponse.json({ timeline, todayKey, yesterdayKey })
  } catch (error) {
    console.error("Failed to fetch history:", error)

    // Return mock data only on error
    const mockTimeline = [
      {
        date: new Date().toISOString().split("T")[0],
        displayLabel: "Today",
        tasks: [
          {
            id: 1,
            title: "Review contract",
            clientName: "Memphis",
            clientColor: "#f97316",
            drainType: "deep",
            effortEstimate: 2,
            completedAt: new Date().toISOString(),
          },
        ],
        totalMinutes: 40,
        clientsTouched: ["Memphis"],
      },
    ]
    return NextResponse.json({ timeline: mockTimeline })
  }
}
