import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients, clientMemory, dailySnapshots, taskEvents } from "@/lib/schema"
import { eq, and, gte, lt, inArray, sql } from "drizzle-orm"
import { getTaskPoints } from "@/lib/domain"
import { DAILY_TARGET_POINTS } from "@/lib/constants"

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

    // Get completed tasks today
    const completedToday = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, startOfDay), lt(tasks.completedAt, endOfDay)))

    const tasksCompleted = completedToday.length
    const pointsEarned = completedToday.reduce((sum, t) => sum + getTaskPoints(t), 0)

    // Get unique clients touched - batch query instead of N+1
    const clientIds = [...new Set(completedToday.map((t) => t.clientId).filter((id): id is number => id !== null))]
    const clientsTouched: string[] = clientIds.length > 0
      ? (await db.select({ name: clients.name }).from(clients).where(inArray(clients.id, clientIds))).map((c) => c.name)
      : []

    // Get drain types used
    const drainTypesUsed = [...new Set(completedToday.map((t) => t.drainType).filter(Boolean))] as string[]

    // Get stale clients (2+ days)
    const staleMemories = await db.select().from(clientMemory).where(gte(clientMemory.staleDays, 2))
    const staleClients = staleMemories.map((m) => m.clientName)

    // Calculate average momentum (percentage of target points)
    const avgMomentum = Math.round((pointsEarned / DAILY_TARGET_POINTS) * 100)

    // Count avoidance incidents (deferred/demoted events today)
    const avoidanceEvents = await db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(taskEvents)
      .where(
        and(
          sql`${taskEvents.eventType} IN ('deferred', 'demoted', 'avoided', 'skipped')`,
          gte(taskEvents.createdAt, startOfDay),
          lt(taskEvents.createdAt, endOfDay)
        )
      )
    const avoidanceIncidents = Number(avoidanceEvents[0]?.count ?? 0)

    // Upsert the snapshot
    await db
      .insert(dailySnapshots)
      .values({
        snapshotDate: today,
        tasksCompleted,
        minutesEarned: pointsEarned, // Legacy field name, now stores points
        clientsTouched,
        drainTypesUsed,
        avgMomentum: String(avgMomentum),
        staleClients,
        avoidanceIncidents,
      })
      .onConflictDoUpdate({
        target: dailySnapshots.snapshotDate,
        set: {
          tasksCompleted,
          minutesEarned: pointsEarned,
          clientsTouched,
          drainTypesUsed,
          avgMomentum: String(avgMomentum),
          staleClients,
          avoidanceIncidents,
        },
      })

    return NextResponse.json({
      success: true,
      snapshot: {
        date: today,
        tasksCompleted,
        pointsEarned,
        clientsTouched,
        drainTypesUsed,
        avgMomentum,
        staleClients,
        avoidanceIncidents,
      },
    })
  } catch (err) {
    console.error("[cron/snapshot] Error:", err)
    return NextResponse.json({ error: "Failed to create snapshot" }, { status: 500 })
  }
}
