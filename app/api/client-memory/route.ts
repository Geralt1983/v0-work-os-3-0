import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { clientMemory, clients, tasks } from "@/lib/schema"
import { eq, and, gte, sql } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()

    // Get current time in EST
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60000)

    // Week start (Monday)
    const weekStart = new Date(estNow)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
    weekStart.setHours(0, 0, 0, 0)

    // Get all active clients
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))

    // Get all client memory entries
    const allMemory = await db.select().from(clientMemory)

    const weeklyTasks = await db
      .select({
        clientId: tasks.clientId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, weekStart)))
      .groupBy(tasks.clientId)

    const weeklyTasksMap = new Map(weeklyTasks.map((w) => [w.clientId, Number(w.count)]))

    const lastActivity = await db
      .select({
        clientId: tasks.clientId,
        lastCompletion: sql<Date>`MAX(${tasks.completedAt})`.as("lastCompletion"),
      })
      .from(tasks)
      .where(eq(tasks.status, "done"))
      .groupBy(tasks.clientId)

    const lastActivityMap = new Map(lastActivity.map((l) => [l.clientId, l.lastCompletion]))

    // Merge clients with their memory settings and stats
    const clientsWithMemory = allClients.map((client) => {
      const memory = allMemory.find((m) => m.clientName === client.name)
      const tasksThisWeek = weeklyTasksMap.get(client.id) || 0
      const lastCompletedAt = lastActivityMap.get(client.id)

      // Calculate days since last activity
      let daysSinceActivity: number | null = null
      if (lastCompletedAt) {
        daysSinceActivity = Math.floor((Date.now() - new Date(lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24))
      }

      return {
        clientId: client.id,
        clientName: client.name,
        color: client.color,
        // Memory fields with defaults
        tier: memory?.tier || "active",
        sentiment: memory?.sentiment || "neutral",
        importance: memory?.importance || "medium",
        notes: memory?.notes || "",
        avoidanceScore: memory?.avoidanceScore || 0,
        preferredWorkTime: memory?.preferredWorkTime || null,
        tasksThisWeek,
        lastCompletedAt: lastCompletedAt ? new Date(lastCompletedAt).toISOString() : null,
        daysSinceActivity,
      }
    })

    return NextResponse.json(clientsWithMemory)
  } catch (error) {
    console.error("[v0] Client memory GET error:", error)
    return NextResponse.json({ error: "Failed to fetch client memory" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const { clientName, tier, sentiment, importance, notes, avoidanceScore, preferredWorkTime } = body

    if (!clientName) {
      return NextResponse.json({ error: "clientName is required" }, { status: 400 })
    }

    // Check if memory entry exists
    const [existing] = await db.select().from(clientMemory).where(eq(clientMemory.clientName, clientName))

    const updateData = {
      tier,
      sentiment,
      importance,
      notes,
      avoidanceScore,
      preferredWorkTime,
      updatedAt: new Date(),
    }

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(clientMemory)
        .set(updateData)
        .where(eq(clientMemory.clientName, clientName))
        .returning()
      return NextResponse.json(updated)
    } else {
      // Create new entry
      const [created] = await db
        .insert(clientMemory)
        .values({
          id: crypto.randomUUID(),
          clientName,
          ...updateData,
          createdAt: new Date(),
        })
        .returning()
      return NextResponse.json(created)
    }
  } catch (error) {
    console.error("[v0] Client memory PUT error:", error)
    return NextResponse.json({ error: "Failed to update client memory" }, { status: 500 })
  }
}
