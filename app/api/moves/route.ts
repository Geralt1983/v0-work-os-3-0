import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, and, ne, desc, asc } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Moves API: Starting GET request")
    const db = getDb()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const clientId = searchParams.get("clientId")
    const excludeCompleted = searchParams.get("excludeCompleted") === "true"

    console.log("[v0] Moves API: Params", { status, clientId, excludeCompleted })

    const query = db
      .select({
        id: moves.id,
        clientId: moves.clientId,
        title: moves.title,
        description: moves.description,
        status: moves.status,
        effortEstimate: moves.effortEstimate,
        effortActual: moves.effortActual,
        drainType: moves.drainType,
        sortOrder: moves.sortOrder,
        createdAt: moves.createdAt,
        updatedAt: moves.updatedAt,
        completedAt: moves.completedAt,
        clientName: clients.name,
      })
      .from(moves)
      .leftJoin(clients, eq(moves.clientId, clients.id))
      .orderBy(asc(moves.sortOrder), desc(moves.createdAt))

    const conditions = []
    if (status) conditions.push(eq(moves.status, status))
    if (clientId) conditions.push(eq(moves.clientId, Number.parseInt(clientId)))
    if (excludeCompleted) conditions.push(ne(moves.status, "done"))

    const allMoves = conditions.length > 0 ? await query.where(and(...conditions)) : await query

    console.log("[v0] Moves API: Fetched", allMoves.length, "moves")

    return NextResponse.json(allMoves)
  } catch (error) {
    console.error("[v0] Moves API error:", error)
    return NextResponse.json({ error: "Failed to fetch moves", details: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Moves API: Starting POST request")
    const db = getDb()
    const body = await request.json()
    console.log("[v0] Moves API: POST body received", body)

    const { clientId, title, description, status, effortEstimate, drainType } = body

    if (!title) {
      console.log("[v0] Moves API: Title is missing")
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const targetStatus = status || "backlog"
    const existingMoves = await db
      .select({ sortOrder: moves.sortOrder })
      .from(moves)
      .where(eq(moves.status, targetStatus))

    const minSortOrder = existingMoves.reduce((min, m) => Math.min(min, m.sortOrder ?? 0), 0)
    const newSortOrder = minSortOrder - 1

    console.log("[v0] Moves API: Inserting move at sortOrder", newSortOrder)

    const [newMove] = await db
      .insert(moves)
      .values({
        clientId: clientId || null,
        title,
        description: description || null,
        status: targetStatus,
        effortEstimate: effortEstimate || 2,
        drainType: drainType || null,
        sortOrder: newSortOrder, // Insert at top of column
        updatedAt: new Date(),
      })
      .returning()

    let clientName: string | null = null
    if (newMove.clientId) {
      const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, newMove.clientId))
      clientName = client?.name ?? null
    }

    const response = { ...newMove, clientName }
    console.log("[v0] Moves API: Move created successfully", response)
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error("[v0] Moves API POST error:", error)
    return NextResponse.json({ error: "Failed to create move", details: String(error) }, { status: 500 })
  }
}
