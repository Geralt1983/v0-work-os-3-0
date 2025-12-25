import { NextResponse } from "next/server"
import { resurrectTask } from "@/lib/backlog-decay"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const graveyardId = Number.parseInt(id)
    const resurrected = await resurrectTask(graveyardId)
    return NextResponse.json(resurrected)
  } catch (error) {
    console.error("Resurrect failed:", error)
    return NextResponse.json({ error: "Resurrect failed" }, { status: 500 })
  }
}
