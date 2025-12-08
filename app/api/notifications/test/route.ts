import { NextResponse } from "next/server"
import { sendNotification } from "@/lib/notifications"

export async function POST(request: Request) {
  try {
    const { message } = await request.json()

    const result = await sendNotification(message || "Test notification from Work-OS", {
      title: "Test",
      tags: "test_tube",
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Test Notification] Error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
