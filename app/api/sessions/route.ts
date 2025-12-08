import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sessions } from "@/lib/schema"
import { randomUUID } from "crypto"

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
