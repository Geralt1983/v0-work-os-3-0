import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, and, ne, desc, asc } from "drizzle-orm"
import { logTaskEvent } from "@/lib/events"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Tasks API: Starting GET request")
    const db = getDb()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const clientId = searchParams.get("clientId")
    const excludeCompleted = searchParams.get("excludeCompleted") === "true"

    console.log("[v0] Tasks API: Params", { status, clientId, excludeCompleted })

    const query = db
      .select({
        id: tasks.id,
        clientId: tasks.clientId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        effortEstimate: tasks.effortEstimate,
        effortActual: tasks.effortActual,
        drainType: tasks.drainType,
        sortOrder: tasks.sortOrder,
        subtasks: tasks.subtasks,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
        pointsAiGuess: tasks.pointsAiGuess,
        pointsFinal: tasks.pointsFinal,
        pointsAdjustedAt: tasks.pointsAdjustedAt,
        clientName: clients.name,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt))

    const conditions = []
    if (status) conditions.push(eq(tasks.status, status))
    if (clientId) conditions.push(eq(tasks.clientId, Number.parseInt(clientId)))
    if (excludeCompleted) conditions.push(ne(tasks.status, "done"))

    const allTasks = conditions.length > 0 ? await query.where(and(...conditions)) : await query

    console.log("[v0] Tasks API: Fetched", allTasks.length, "tasks")

    return NextResponse.json(allTasks)
  } catch (error) {
    console.error("[v0] Tasks API error:", error)
    return NextResponse.json({ error: "Failed to fetch tasks", details: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Tasks API: Starting POST request")
    const db = getDb()
    const body = await request.json()
    console.log("[v0] Tasks API: POST body received", body)

    const { clientId, title, description, status, effortEstimate, drainType, pointsAiGuess, pointsFinal } = body

    if (!title) {
      console.log("[v0] Tasks API: Title is missing")
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const parsedClientId = clientId && clientId !== "" ? Number(clientId) : null
    const validClientId = parsedClientId && !isNaN(parsedClientId) ? parsedClientId : null

    const targetStatus = status || "backlog"
    const existingTasks = await db
      .select({ sortOrder: tasks.sortOrder })
      .from(tasks)
      .where(eq(tasks.status, targetStatus))

    const minSortOrder = existingTasks.reduce((min, t) => Math.min(min, t.sortOrder ?? 0), 0)
    const newSortOrder = minSortOrder - 1

    console.log("[v0] Tasks API: Inserting task with clientId:", validClientId, "sortOrder:", newSortOrder)

    const [newTask] = await db
      .insert(tasks)
      .values({
        clientId: validClientId,
        title,
        description: description || null,
        status: targetStatus,
        effortEstimate: effortEstimate || 2,
        drainType: drainType || null,
        sortOrder: newSortOrder,
        updatedAt: new Date(),
        pointsAiGuess: pointsAiGuess || null,
        pointsFinal: pointsFinal || null,
        pointsAdjustedAt: pointsFinal ? new Date() : null,
      })
      .returning()

    await logTaskEvent({
      taskId: newTask.id,
      eventType: "created",
      toStatus: targetStatus,
      metadata: { effortEstimate: effortEstimate || 2, drainType: drainType || null },
    })

    let clientName: string | null = null
    if (newTask.clientId) {
      const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, newTask.clientId))
      clientName = client?.name ?? null
    }

    const response = { ...newTask, clientName }
    console.log("[v0] Tasks API: Task created successfully", response)
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error("[v0] Tasks API POST error:", error)
    return NextResponse.json({ error: "Failed to create task", details: String(error) }, { status: 500 })
  }
}
