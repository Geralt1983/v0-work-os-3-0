import { NextResponse } from "next/server"
import { archiveTask } from "@/lib/backlog-decay"

export async function POST(request: Request) {
  try {
    const { taskId, reason } = await request.json()
    const result = await archiveTask(taskId, reason || "manual")
    return NextResponse.json(result)
  } catch (error) {
    console.error("Archive failed:", error)
    return NextResponse.json({ error: "Archive failed" }, { status: 500 })
  }
}
