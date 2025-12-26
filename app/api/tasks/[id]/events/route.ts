import { NextResponse } from "next/server"
import { getTaskHistory } from "@/lib/events"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskId = Number.parseInt(id, 10)

    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 })
    }

    const events = await getTaskHistory(taskId)
    return NextResponse.json(events)
  } catch (err) {
    console.error("[api/tasks/events] Error:", err)
    return NextResponse.json({ error: "Failed to get task events" }, { status: 500 })
  }
}
