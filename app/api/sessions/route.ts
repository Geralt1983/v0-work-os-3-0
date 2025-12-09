import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sessions } from "@/lib/schema"
import { randomUUID } from "crypto"
import { desc, gte, sql } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()

    // Get sessions from last 7 days
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const recentSessions = await db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        lastActiveAt: sessions.lastActiveAt,
        messageCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM messages WHERE messages.session_id = ${sessions.id}), 0)`,
        preview: sql<string>`(SELECT content FROM messages WHERE messages.session_id = ${sessions.id} AND role = 'user' ORDER BY timestamp ASC LIMIT 1)`,
      })
      .from(sessions)
      .where(gte(sessions.createdAt, oneWeekAgo))
      .orderBy(desc(sessions.lastActiveAt))
      .limit(20)

    return NextResponse.json(recentSessions)
  } catch (error) {
    console.error("Failed to fetch sessions:", error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const db = getDb()
    const id = randomUUID()
    const [session] = await db
      .insert(sessions)
      .values({
        id,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      })
      .returning()

    return NextResponse.json(session)
  } catch (error) {
    console.error("Failed to create session:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
