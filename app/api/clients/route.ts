import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"

// GET all clients
export async function GET() {
  try {
    const allClients = await db.select().from(clients)
    return NextResponse.json(allClients)
  } catch (error) {
    console.error("Failed to fetch clients:", error)
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
  }
}

// POST create client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, color, isActive } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        name,
        type: type || "standard",
        color: color || null,
        isActive: isActive ?? 1,
      })
      .returning()

    return NextResponse.json(newClient, { status: 201 })
  } catch (error) {
    console.error("Failed to create client:", error)
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 })
  }
}
