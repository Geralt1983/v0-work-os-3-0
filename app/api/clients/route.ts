import { type NextRequest, NextResponse } from "next/server"
import { getDb, isPreviewWithoutDb } from "@/lib/db"
import { clients } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { MOCK_CLIENTS } from "@/lib/mock-data"

// GET all clients
export async function GET() {
  try {
    console.log("[v0] Clients API: Starting GET request")
    
    // Return mock data in preview mode without database
    if (isPreviewWithoutDb()) {
      console.log("[v0] Clients API: Using mock data (preview mode)")
      return NextResponse.json(MOCK_CLIENTS)
    }
    
    const db = getDb()
    const allClients = await db.select().from(clients).where(eq(clients.isActive, 1))
    console.log("[v0] Clients API: Fetched", allClients.length, "clients")
    return NextResponse.json(allClients)
  } catch (error) {
    console.error("[v0] Clients API error:", error)
    return NextResponse.json({ error: "Failed to fetch clients", details: String(error) }, { status: 500 })
  }
}

// POST create client
export async function POST(request: NextRequest) {
  try {
    // In preview mode without database, return mock success
    if (isPreviewWithoutDb()) {
      const body = await request.json()
      const mockClient = {
        id: Date.now(),
        name: body.name,
        type: body.type || "client",
        color: body.color || null,
        isActive: 1,
        createdAt: new Date().toISOString(),
      }
      return NextResponse.json(mockClient, { status: 201 })
    }
    
    const db = getDb()
    const body = await request.json()
    const { name, type, color, isActive } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        name,
        type: type || "client",
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
