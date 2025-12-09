import { NextResponse } from "next/server"
import { resurrectMove } from "@/lib/backlog-decay"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const graveyardId = Number.parseInt(id)
    const resurrected = await resurrectMove(graveyardId)
    return NextResponse.json(resurrected)
  } catch (error) {
    console.error("Resurrect failed:", error)
    return NextResponse.json({ error: "Resurrect failed" }, { status: 500 })
  }
}
