import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { clients } from "@/lib/schema"
import { eq } from "drizzle-orm"

// GET single client
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, Number.parseInt(id)))

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error("Failed to fetch client:", error)
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 })
  }
}

// PATCH update client
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const body = await request.json()

    const [updated] = await db
      .update(clients)
      .set(body)
      .where(eq(clients.id, Number.parseInt(id)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update client:", error)
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 })
  }
}

// DELETE client
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb()
    const { id } = await params
    const [deleted] = await db
      .delete(clients)
      .where(eq(clients.id, Number.parseInt(id)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete client:", error)
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 })
  }
}
