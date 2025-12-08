import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { moves } from "@/lib/schema"
import { eq } from "drizzle-orm"

const statusOrder = ["backlog", "queued", "active"]

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const [move] = await db
      .select()
      .from(moves)
      .where(eq(moves.id, Number.parseInt(id)))
    if (!move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 })
    }

    const currentIndex = statusOrder.indexOf(move.status)
    if (currentIndex <= 0) {
      return NextResponse.json(move)
    }

    const newStatus = statusOrder[currentIndex - 1]
    const [updated] = await db
      .update(moves)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(moves.id, Number.parseInt(id)))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to demote move:", error)
    return NextResponse.json({ error: "Failed to demote move" }, { status: 500 })
  }
}
