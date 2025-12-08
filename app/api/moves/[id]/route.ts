import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients } from "@/lib/schema"
import { eq } from "drizzle-orm"

// GET single move
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const [move] = await db
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
      .where(eq(moves.id, Number.parseInt(id)))

    if (!move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 })
    }

    return NextResponse.json(move)
  } catch (error) {
    console.error("Failed to fetch move:", error)
    return NextResponse.json({ error: "Failed to fetch move" }, { status: 500 })
  }
}

// PATCH update move
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const body = await request.json()

    const updateData = {
      ...body,
      updatedAt: new Date(),
    }

    const [updated] = await db
      .update(moves)
      .set(updateData)
      .where(eq(moves.id, Number.parseInt(id)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update move:", error)
    return NextResponse.json({ error: "Failed to update move" }, { status: 500 })
  }
}

// DELETE move
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const [deleted] = await db
      .delete(moves)
      .where(eq(moves.id, Number.parseInt(id)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete move:", error)
    return NextResponse.json({ error: "Failed to delete move" }, { status: 500 })
  }
}
