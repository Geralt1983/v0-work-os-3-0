import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq, and, asc } from "drizzle-orm"

// GET all moves (with optional filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const clientId = searchParams.get("clientId")

    // Build query with joins to get client name
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
      .orderBy(asc(moves.sortOrder), asc(moves.createdAt))

    // Apply filters
    const conditions = []
    if (status) {
      conditions.push(eq(moves.status, status))
    }
    if (clientId) {
      conditions.push(eq(moves.clientId, Number.parseInt(clientId)))
    }

    const allMoves = conditions.length > 0 ? await query.where(and(...conditions)) : await query

    return NextResponse.json(allMoves)
  } catch (error) {
    console.error("Failed to fetch moves:", error)
    return NextResponse.json({ error: "Failed to fetch moves" }, { status: 500 })
  }
}

// POST create move
export async function POST(request: NextRequest) {
  try {
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
        effortEstimate: effortEstimate || null,
        drainType: drainType || null,
        sortOrder: sortOrder || null,
      })
      .returning()

    return NextResponse.json(newMove, { status: 201 })
  } catch (error) {
    console.error("Failed to create move:", error)
    return NextResponse.json({ error: "Failed to create move" }, { status: 500 })
  }
}
