import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { moves, clients, clientMemory, dailySnapshots } from "@/lib/schema"
import { eq, and, gte, lt } from "drizzle-orm"

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = await getDb()

    // Get today's date in EST
    const now = new Date()
    const estOffset = -5 * 60
    const estTime = new Date(now.getTime() + estOffset * 60 * 1000)
    const today = estTime.toISOString().split("T")[0]

    // Get start/end of today in EST
    const startOfDay = new Date(`${today}T00:00:00-05:00`)
    const endOfDay = new Date(`${today}T23:59:59-05:00`)

    // Get completed moves today
    const completedToday = await db
      .select({
        id: moves.id,
        clientId: moves.clientId,
        effortEstimate: moves.effortEstimate,
        drainType: moves.drainType,
      })
      .from(moves)
      .where(and(eq(moves.status, "done"), gte(moves.completedAt, startOfDay), lt(moves.completedAt, endOfDay)))

    const movesCompleted = completedToday.length
    const minutesEarned = completedToday.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)

    // Get unique clients touched
    const clientIds = [...new Set(completedToday.map((m) => m.clientId).filter(Boolean))]
    const clientsTouched: string[] = []
    for (const id of clientIds) {
      const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, id!)).limit(1)
      if (client) clientsTouched.push(client.name)
    }

    // Get drain types used
    const drainTypesUsed = [...new Set(completedToday.map((m) => m.drainType).filter(Boolean))] as string[]

    // Get stale clients (2+ days)
    const staleMemories = await db.select().from(clientMemory).where(gte(clientMemory.staleDays, 2))
    const staleClients = staleMemories.map((m) => m.clientName)

    // Calculate average momentum (simplified - just use completion percentage)
    const targetMinutes = 180
    const avgMomentum = Math.round((minutesEarned / targetMinutes) * 100)

    // Upsert the snapshot
    await db
      .insert(dailySnapshots)
      .values({
        snapshotDate: today,
        movesCompleted,
        minutesEarned,
        clientsTouched,
        drainTypesUsed,
        avgMomentum: String(avgMomentum),
        staleClients,
        avoidanceIncidents: 0, // TODO: Calculate from move_events
      })
      .onConflictDoUpdate({
        target: dailySnapshots.snapshotDate,
        set: {
          movesCompleted,
          minutesEarned,
          clientsTouched,
          drainTypesUsed,
          avgMomentum: String(avgMomentum),
          staleClients,
        },
      })

    return NextResponse.json({
      success: true,
      snapshot: {
        date: today,
        movesCompleted,
        minutesEarned,
        clientsTouched,
        drainTypesUsed,
        avgMomentum,
        staleClients,
      },
    })
  } catch (err) {
    console.error("[cron/snapshot] Error:", err)
    return NextResponse.json({ error: "Failed to create snapshot" }, { status: 500 })
  }
}
