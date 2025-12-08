import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { messages } from "@/lib/schema"
import { eq, asc } from "drizzle-orm"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const allMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(asc(messages.timestamp))

    return NextResponse.json(allMessages)
  } catch (error) {
    console.error("Failed to fetch messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}
