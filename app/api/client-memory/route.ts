import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { clientMemory, clients } from "@/lib/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()

    // Get all active clients
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))

    // Get all client memory entries
    const allMemory = await db.select().from(clientMemory)

    // Merge clients with their memory settings
    const clientsWithMemory = allClients.map((client) => {
      const memory = allMemory.find((m) => m.clientName === client.name)
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
