import { NextResponse } from "next/server"
import { getMoveHistory } from "@/lib/events"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const moveId = Number.parseInt(id, 10)

    if (isNaN(moveId)) {
      return NextResponse.json({ error: "Invalid move ID" }, { status: 400 })
    }

    const events = await getMoveHistory(moveId)
    return NextResponse.json(events)
  } catch (err) {
    console.error("[api/moves/events] Error:", err)
    return NextResponse.json({ error: "Failed to get move events" }, { status: 500 })
  }
}
