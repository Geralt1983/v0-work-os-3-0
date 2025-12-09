import { NextResponse } from "next/server"
import { archiveMove } from "@/lib/backlog-decay"

export async function POST(request: Request) {
  try {
    const { moveId, reason } = await request.json()
    const result = await archiveMove(moveId, reason || "manual")
    return NextResponse.json(result)
  } catch (error) {
    console.error("Archive failed:", error)
    return NextResponse.json({ error: "Archive failed" }, { status: 500 })
  }
}
