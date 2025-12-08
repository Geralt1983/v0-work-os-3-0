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
    const db = getDb()
    const body = await request.json()
    const { clientId, title, description, status, effortEstimate, drainType, sortOrder } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const [newMove] = await db
      .insert(moves)
      .values({
        clientId: clientId || null,
        title,
        description: description || null,
        status: status || "backlog",
        effortEstimate: effortEstimate || 2,
        drainType: drainType || null,
        sortOrder: sortOrder || 0,
        updatedAt: new Date(),
      })
      .returning()

    return NextResponse.json(newMove, { status: 201 })
  } catch (error) {
    console.error("Failed to create move:", error)
    return NextResponse.json({ error: "Failed to create move" }, { status: 500 })
  }
}
