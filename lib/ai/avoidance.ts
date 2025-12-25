import { getDb } from "../db"
import { tasks, clients, clientMemory, taskEvents } from "../schema"
import { eq, sql, and, gte } from "drizzle-orm"

export interface AvoidanceReport {
  staleClients: StaleClient[]
  frequentlyDeferred: DeferredTask[]
  avoidancePatterns: AvoidancePattern[]
  overallScore: number
  recommendations: string[]
}

interface StaleClient {
  name: string
  daysSinceTouch: number
  lastMoveTitle: string | null
  severity: "warning" | "critical" | "severe"
}

interface DeferredTask {
  taskId: number
  title: string
  clientName: string
  deferCount: number
  daysSinceCreated: number
}

interface AvoidancePattern {
  type: string
  description: string
  evidence: string
}

export async function generateAvoidanceReport(): Promise<AvoidanceReport> {
  const staleClients = await detectStaleClients()
  const frequentlyDeferred = await detectFrequentlyDeferred()
  const avoidancePatterns = await detectAvoidancePatterns()

  // Calculate overall avoidance score (0-100, lower is better)
  const staleScore = staleClients.length * 15
  const deferredScore = frequentlyDeferred.length * 10
  const patternScore = avoidancePatterns.length * 20
  const overallScore = Math.min(100, staleScore + deferredScore + patternScore)

  const recommendations = generateRecommendations(staleClients, frequentlyDeferred, avoidancePatterns)

  return {
    staleClients,
    frequentlyDeferred,
    avoidancePatterns,
    overallScore,
    recommendations,
  }
}

async function detectStaleClients(): Promise<StaleClient[]> {
  try {
    const db = await getDb()
    const memories = await db.select().from(clientMemory).where(gte(clientMemory.staleDays, 2))

    return memories.map((m) => ({
      name: m.clientName,
      daysSinceTouch: m.staleDays || 0,
      lastMoveTitle: m.lastTaskDescription || null,
      severity: (m.staleDays || 0) >= 5 ? "severe" : (m.staleDays || 0) >= 3 ? "critical" : "warning",
    }))
  } catch (err) {
    console.error("[avoidance] Failed to detect stale clients:", err)
    return []
  }
}

async function detectFrequentlyDeferred(): Promise<DeferredTask[]> {
  try {
    const db = await getDb()

    // Find tasks that have been deferred 3+ times
    const deferredTasks = await db
      .select({
        taskId: taskEvents.taskId,
        deferCount: sql<number>`COUNT(*)`.as("defer_count"),
      })
      .from(taskEvents)
      .where(sql`event_type IN ('deferred', 'demoted')`)
      .groupBy(taskEvents.taskId)
      .having(sql`COUNT(*) >= 2`)

    const results: DeferredTask[] = []

    for (const dt of deferredTasks) {
      const [task] = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          clientId: tasks.clientId,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .where(eq(tasks.id, dt.taskId))
        .limit(1)

      if (task && task.status !== "done") {
        let clientName = "Unknown"
        if (task.clientId) {
          const [client] = await db
            .select({ name: clients.name })
            .from(clients)
            .where(eq(clients.id, task.clientId))
            .limit(1)
          if (client) clientName = client.name
        }

        const daysSinceCreated = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24))

        results.push({
          taskId: task.id,
          title: task.title,
          clientName,
          deferCount: dt.deferCount,
          daysSinceCreated,
        })
      }
    }

    return results
  } catch (err) {
    console.error("[avoidance] Failed to detect frequently deferred:", err)
    return []
  }
}

async function detectAvoidancePatterns(): Promise<AvoidancePattern[]> {
  const patterns: AvoidancePattern[] = []

  try {
    const db = await getDb()

    // Pattern 1: Client concentration (one client getting all attention)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const clientDistribution = await db
      .select({
        clientId: tasks.clientId,
        taskCount: sql<number>`COUNT(*)`.as("task_count"),
      })
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, sevenDaysAgo)))
      .groupBy(tasks.clientId)

    if (clientDistribution.length > 0) {
      const totalTasks = clientDistribution.reduce((sum, c) => sum + c.taskCount, 0)
      const maxTasks = Math.max(...clientDistribution.map((c) => c.taskCount))
      const concentration = maxTasks / totalTasks

      if (concentration > 0.6 && clientDistribution.length > 2) {
        patterns.push({
          type: "client_concentration",
          description: "One client is getting disproportionate attention",
          evidence: `${Math.round(concentration * 100)}% of tasks went to one client this week`,
        })
      }
    }

    // Pattern 2: Drain type avoidance
    const drainDistribution = await db
      .select({
        drainType: tasks.drainType,
        taskCount: sql<number>`COUNT(*)`.as("task_count"),
      })
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, sevenDaysAgo)))
      .groupBy(tasks.drainType)

    const drainTypes = ["deep", "shallow", "admin"]
    const usedDrainTypes = drainDistribution.map((d) => d.drainType)
    const avoidedDrainTypes = drainTypes.filter((dt) => !usedDrainTypes.includes(dt))

    if (avoidedDrainTypes.length >= 2) {
      patterns.push({
        type: "drain_avoidance",
        description: `Avoiding ${avoidedDrainTypes.join(", ")} type work`,
        evidence: `No ${avoidedDrainTypes.join(" or ")} tasks completed this week`,
      })
    }

    // Pattern 3: Morning vs afternoon avoidance
    const morningTasks = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "done"),
          gte(tasks.completedAt, sevenDaysAgo),
          sql`EXTRACT(HOUR FROM completed_at AT TIME ZONE 'America/New_York') < 12`,
        ),
      )

    const afternoonTasks = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "done"),
          gte(tasks.completedAt, sevenDaysAgo),
          sql`EXTRACT(HOUR FROM completed_at AT TIME ZONE 'America/New_York') >= 12`,
        ),
      )

    const morningCount = morningTasks[0]?.count ?? 0
    const afternoonCount = afternoonTasks[0]?.count ?? 0
    const totalTimeCount = morningCount + afternoonCount

    if (totalTimeCount > 5) {
      if (morningCount < totalTimeCount * 0.2) {
        patterns.push({
          type: "morning_avoidance",
          description: "Most work happens in the afternoon",
          evidence: `Only ${Math.round((morningCount / totalTimeCount) * 100)}% of moves completed before noon`,
        })
      } else if (afternoonCount < totalTimeCount * 0.2) {
        patterns.push({
          type: "afternoon_avoidance",
          description: "Most work happens in the morning",
          evidence: `Only ${Math.round((afternoonCount / totalTimeCount) * 100)}% of moves completed after noon`,
        })
      }
    }
  } catch (err) {
    console.error("[avoidance] Failed to detect patterns:", err)
  }

  return patterns
}

function generateRecommendations(
  staleClients: StaleClient[],
  frequentlyDeferred: DeferredTask[],
  avoidancePatterns: AvoidancePattern[],
): string[] {
  const recommendations: string[] = []

  // Stale client recommendations
  const severeClients = staleClients.filter((c) => c.severity === "severe")
  if (severeClients.length > 0) {
    recommendations.push(
      `URGENT: ${severeClients.map((c) => c.name).join(", ")} haven't been touched in 5+ days. Start with one small task for each.`,
    )
  }

  const criticalClients = staleClients.filter((c) => c.severity === "critical")
  if (criticalClients.length > 0) {
    recommendations.push(
      `Touch ${criticalClients.map((c) => c.name).join(", ")} today to prevent them from going stale.`,
    )
  }

  // Deferred task recommendations
  if (frequentlyDeferred.length > 0) {
    const worstTask = frequentlyDeferred.reduce((a, b) => (a.deferCount > b.deferCount ? a : b))
    recommendations.push(
      `"${worstTask.title}" has been deferred ${worstTask.deferCount} times. Either do it now, break it down, or delete it.`,
    )
  }

  // Pattern-based recommendations
  for (const pattern of avoidancePatterns) {
    switch (pattern.type) {
      case "client_concentration":
        recommendations.push(`Try to spread work across more clients. ${pattern.evidence}`)
        break
      case "drain_avoidance":
        recommendations.push(
          `Mix in some ${pattern.description.replace("Avoiding ", "").replace(" type work", "")} work to stay balanced.`,
        )
        break
      case "morning_avoidance":
        recommendations.push(`Try completing one important task before noon tomorrow.`)
        break
      case "afternoon_avoidance":
        recommendations.push(`Save some easier tasks for the afternoon to maintain momentum.`)
        break
    }
  }

  // Default recommendation if nothing specific
  if (recommendations.length === 0) {
    recommendations.push("No major avoidance patterns detected. Keep up the good work!")
  }

  return recommendations
}

// Get a quick summary for the AI
export async function getAvoidanceSummary(): Promise<string> {
  const report = await generateAvoidanceReport()

  let summary = ""

  if (report.staleClients.length > 0) {
    const clientList = report.staleClients.map((c) => `${c.name} (${c.daysSinceTouch}d)`).join(", ")
    summary += `Stale clients: ${clientList}. `
  }

  if (report.frequentlyDeferred.length > 0) {
    summary += `${report.frequentlyDeferred.length} tasks being repeatedly deferred. `
  }

  if (report.avoidancePatterns.length > 0) {
    summary += `Patterns: ${report.avoidancePatterns.map((p) => p.description).join("; ")}. `
  }

  if (report.recommendations.length > 0) {
    summary += `Top recommendation: ${report.recommendations[0]}`
  }

  return summary || "No avoidance issues detected."
}
