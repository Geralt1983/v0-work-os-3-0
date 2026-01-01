// =============================================================================
// STALENESS TRACKING
// Client staleness detection and stale wall enforcement
// =============================================================================

import { getDb } from "@/lib/db"
import { tasks, clients } from "@/lib/schema"
import { eq, ne, desc, and, gte } from "drizzle-orm"
import { STALE_THRESHOLD_DAYS, DAILY_TARGET_POINTS } from "@/lib/constants"
import { getESTTodayStart, estToUTC } from "@/lib/domain/timezone"
import { calculateTotalPoints } from "@/lib/domain/task-types"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ClientStalenessInfo {
  clientId: number
  clientName: string
  daysSinceLastTask: number
  lastCompletedAt: Date | null
  isStale: boolean
}

export interface DayCompletionStatus {
  canComplete: boolean
  pointsEarned: number
  pointsTarget: number
  staleBlockers: string[]
  message: string
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

/**
 * Get staleness info for all external clients
 * Returns a Map of client name to days since last completed task
 */
export async function getClientStaleness(): Promise<Map<string, number>> {
  const db = getDb()

  // Get all external clients (exclude internal)
  const allClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(
      ne(clients.type, "internal"),
      eq(clients.isActive, 1)
    ))

  const stalenessMap = new Map<string, number>()
  const now = new Date()

  for (const client of allClients) {
    // Get most recent completed task for this client
    const [lastTask] = await db
      .select({ completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(
        eq(tasks.clientId, client.id),
        eq(tasks.status, "done")
      ))
      .orderBy(desc(tasks.completedAt))
      .limit(1)

    let daysSinceLastTask: number

    if (lastTask?.completedAt) {
      const diffMs = now.getTime() - lastTask.completedAt.getTime()
      daysSinceLastTask = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    } else {
      // Client has never had a completed task - treat as maximally stale
      daysSinceLastTask = 999
    }

    stalenessMap.set(client.name, daysSinceLastTask)
  }

  return stalenessMap
}

/**
 * Get detailed staleness info for all clients
 */
export async function getClientStalenessDetails(): Promise<ClientStalenessInfo[]> {
  const db = getDb()

  // Get all external clients
  const allClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(
      ne(clients.type, "internal"),
      eq(clients.isActive, 1)
    ))

  const results: ClientStalenessInfo[] = []
  const now = new Date()

  for (const client of allClients) {
    // Get most recent completed task for this client
    const [lastTask] = await db
      .select({ completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(
        eq(tasks.clientId, client.id),
        eq(tasks.status, "done")
      ))
      .orderBy(desc(tasks.completedAt))
      .limit(1)

    let daysSinceLastTask: number
    let lastCompletedAt: Date | null = null

    if (lastTask?.completedAt) {
      lastCompletedAt = lastTask.completedAt
      const diffMs = now.getTime() - lastTask.completedAt.getTime()
      daysSinceLastTask = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    } else {
      daysSinceLastTask = 999
    }

    results.push({
      clientId: client.id,
      clientName: client.name,
      daysSinceLastTask,
      lastCompletedAt,
      isStale: daysSinceLastTask >= STALE_THRESHOLD_DAYS,
    })
  }

  // Sort by staleness (most stale first)
  return results.sort((a, b) => b.daysSinceLastTask - a.daysSinceLastTask)
}

/**
 * Get list of client names that are blocking day completion (5+ days stale)
 */
export async function getStaleBlockers(): Promise<string[]> {
  const stalenessMap = await getClientStaleness()
  const blockers: string[] = []

  for (const [clientName, days] of stalenessMap) {
    if (days >= STALE_THRESHOLD_DAYS) {
      blockers.push(clientName)
    }
  }

  return blockers.sort((a, b) => {
    // Sort by staleness level (most stale first)
    const daysA = stalenessMap.get(a) ?? 0
    const daysB = stalenessMap.get(b) ?? 0
    return daysB - daysA
  })
}

/**
 * Check if the day can be marked complete
 * Day is complete when: points >= target AND no stale blockers
 */
export async function canCompleteDay(): Promise<DayCompletionStatus> {
  const db = getDb()
  const now = new Date()
  const todayUTC = estToUTC(getESTTodayStart(now), now)

  // Get tasks completed today
  const completedToday = await db
    .select()
    .from(tasks)
    .where(and(
      eq(tasks.status, "done"),
      gte(tasks.completedAt, todayUTC)
    ))

  const pointsEarned = calculateTotalPoints(completedToday)
  const pointsTarget = DAILY_TARGET_POINTS
  const staleBlockers = await getStaleBlockers()

  const pointsMet = pointsEarned >= pointsTarget
  const noBlockers = staleBlockers.length === 0
  const canComplete = pointsMet && noBlockers

  let message: string

  if (canComplete) {
    message = "Day complete! You hit your target and all clients are fresh."
  } else if (!pointsMet && noBlockers) {
    message = `Need ${pointsTarget - pointsEarned} more points to complete the day.`
  } else if (pointsMet && !noBlockers) {
    message = `Points target met, but ${staleBlockers.length} stale client${staleBlockers.length > 1 ? "s" : ""} blocking: ${staleBlockers.slice(0, 3).join(", ")}${staleBlockers.length > 3 ? "..." : ""}`
  } else {
    message = `Need ${pointsTarget - pointsEarned} more points. Also ${staleBlockers.length} stale client${staleBlockers.length > 1 ? "s" : ""} blocking.`
  }

  return {
    canComplete,
    pointsEarned,
    pointsTarget,
    staleBlockers,
    message,
  }
}

/**
 * Get clients that are approaching staleness threshold (3-4 days)
 * Useful for proactive suggestions
 */
export async function getClientsApproachingStale(): Promise<ClientStalenessInfo[]> {
  const details = await getClientStalenessDetails()
  return details.filter(c => c.daysSinceLastTask >= 3 && c.daysSinceLastTask < STALE_THRESHOLD_DAYS)
}

/**
 * Check if completing a task for a specific client would clear a stale blocker
 */
export async function wouldClearBlocker(clientId: number): Promise<boolean> {
  const details = await getClientStalenessDetails()
  const clientInfo = details.find(c => c.clientId === clientId)
  return clientInfo?.isStale ?? false
}
