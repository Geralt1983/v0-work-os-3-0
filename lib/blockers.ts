// =============================================================================
// BLOCKER DETECTION
// Track consecutive skips and surface blockers for stale clients
// =============================================================================

import { getDb } from "@/lib/db"
import { clientMemory, clients, tasks } from "@/lib/schema"
import { eq, and, ne } from "drizzle-orm"
import { BLOCKER_SKIP_THRESHOLD } from "@/lib/constants"
import { getESTDateString } from "@/lib/domain/timezone"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface BlockerInfo {
  clientId: number
  clientName: string
  consecutiveSkips: number
  lastSkipDate: string | null
  blockerReason: string | null
  needsBlockerPrompt: boolean
}

export interface SkipResult {
  clientName: string
  newSkipCount: number
  shouldPromptBlocker: boolean
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

/**
 * Record that a client was skipped today (user deferred or avoided working on them)
 * Returns whether the blocker prompt should be shown
 */
export async function recordClientSkip(clientId: number): Promise<SkipResult> {
  const db = getDb()
  const today = getESTDateString()

  // Get client info
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))

  if (!client) {
    throw new Error(`Client with id ${clientId} not found`)
  }

  // Get or create client memory entry
  const [existing] = await db
    .select()
    .from(clientMemory)
    .where(eq(clientMemory.clientName, client.name))

  let newSkipCount: number

  if (existing) {
    // If already skipped today, don't increment
    if (existing.lastSkipDate === today) {
      return {
        clientName: client.name,
        newSkipCount: existing.consecutiveSkips ?? 0,
        shouldPromptBlocker: (existing.consecutiveSkips ?? 0) >= BLOCKER_SKIP_THRESHOLD,
      }
    }

    // Increment skip count
    newSkipCount = (existing.consecutiveSkips ?? 0) + 1

    await db
      .update(clientMemory)
      .set({
        consecutiveSkips: newSkipCount,
        lastSkipDate: today,
        updatedAt: new Date(),
      })
      .where(eq(clientMemory.id, existing.id))
  } else {
    // Create new client memory entry
    newSkipCount = 1
    const id = `cm_${client.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`

    await db.insert(clientMemory).values({
      id,
      clientName: client.name,
      consecutiveSkips: newSkipCount,
      lastSkipDate: today,
    })
  }

  return {
    clientName: client.name,
    newSkipCount,
    shouldPromptBlocker: newSkipCount >= BLOCKER_SKIP_THRESHOLD,
  }
}

/**
 * Clear skip count when a task is completed for a client
 */
export async function clearClientSkips(clientId: number): Promise<void> {
  const db = getDb()

  // Get client info
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))

  if (!client) return

  await db
    .update(clientMemory)
    .set({
      consecutiveSkips: 0,
      lastSkipDate: null,
      blockerReason: null,
      updatedAt: new Date(),
    })
    .where(eq(clientMemory.clientName, client.name))
}

/**
 * Record blocker reason for a client
 */
export async function recordBlockerReason(clientId: number, reason: string): Promise<void> {
  const db = getDb()

  // Get client info
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))

  if (!client) {
    throw new Error(`Client with id ${clientId} not found`)
  }

  // Get or create client memory entry
  const [existing] = await db
    .select()
    .from(clientMemory)
    .where(eq(clientMemory.clientName, client.name))

  if (existing) {
    await db
      .update(clientMemory)
      .set({
        blockerReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(clientMemory.id, existing.id))
  } else {
    const id = `cm_${client.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`

    await db.insert(clientMemory).values({
      id,
      clientName: client.name,
      blockerReason: reason,
    })
  }
}

/**
 * Get all clients that need blocker prompts (3+ consecutive skips without a recorded reason)
 */
export async function getClientsNeedingBlockerPrompt(): Promise<BlockerInfo[]> {
  const db = getDb()

  // Get all external clients
  const allClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(
      ne(clients.type, "internal"),
      eq(clients.isActive, 1)
    ))

  const results: BlockerInfo[] = []

  for (const client of allClients) {
    const [memory] = await db
      .select()
      .from(clientMemory)
      .where(eq(clientMemory.clientName, client.name))

    const consecutiveSkips = memory?.consecutiveSkips ?? 0
    const needsBlockerPrompt = consecutiveSkips >= BLOCKER_SKIP_THRESHOLD && !memory?.blockerReason

    if (needsBlockerPrompt) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        consecutiveSkips,
        lastSkipDate: memory?.lastSkipDate ?? null,
        blockerReason: memory?.blockerReason ?? null,
        needsBlockerPrompt,
      })
    }
  }

  // Sort by skip count descending
  return results.sort((a, b) => b.consecutiveSkips - a.consecutiveSkips)
}

/**
 * Get blocker info for a specific client
 */
export async function getClientBlockerInfo(clientId: number): Promise<BlockerInfo | null> {
  const db = getDb()

  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))

  if (!client) return null

  const [memory] = await db
    .select()
    .from(clientMemory)
    .where(eq(clientMemory.clientName, client.name))

  const consecutiveSkips = memory?.consecutiveSkips ?? 0

  return {
    clientId: client.id,
    clientName: client.name,
    consecutiveSkips,
    lastSkipDate: memory?.lastSkipDate ?? null,
    blockerReason: memory?.blockerReason ?? null,
    needsBlockerPrompt: consecutiveSkips >= BLOCKER_SKIP_THRESHOLD && !memory?.blockerReason,
  }
}

/**
 * Get all clients with recorded blockers
 */
export async function getClientsWithBlockers(): Promise<BlockerInfo[]> {
  const db = getDb()

  // Get all external clients
  const allClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(
      ne(clients.type, "internal"),
      eq(clients.isActive, 1)
    ))

  const results: BlockerInfo[] = []

  for (const client of allClients) {
    const [memory] = await db
      .select()
      .from(clientMemory)
      .where(eq(clientMemory.clientName, client.name))

    if (memory?.blockerReason) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        consecutiveSkips: memory.consecutiveSkips ?? 0,
        lastSkipDate: memory.lastSkipDate ?? null,
        blockerReason: memory.blockerReason,
        needsBlockerPrompt: false,
      })
    }
  }

  return results
}
