import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sessions, messages } from "@/lib/schema"
import { eq } from "drizzle-orm"

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json()
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    const db = getDb()
    
    // Delete messages for this session
    await db.delete(messages).where(eq(messages.sessionId, sessionId))
    
    // Delete the session
    await db.delete(sessions).where(eq(sessions.id, sessionId))

    return NextResponse.json({ success: true, message: "Chat cleared" })
  } catch (error) {
    console.error("Clear chat error:", error)
    return NextResponse.json({ error: "Failed to clear chat" }, { status: 500 })
  }
}
