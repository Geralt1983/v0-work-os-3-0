import { NextResponse } from "next/server"
import { getDb, isPreviewWithoutDb } from "@/lib/db"
import { tasks, clients, clientMemory } from "@/lib/schema"
import { eq, and, gte, sql } from "drizzle-orm"
import { MOCK_TASKS, MOCK_CLIENTS } from "@/lib/mock-data"

interface ScoredTask {
  id: number
  title: string
  clientId: number | null
  clientName: string | null
  clientColor: string | null
  drainType: string | null
  effortEstimate: number | null
  createdAt: Date
  score: number
  reason: string
  daysInBacklog: number
}

function getPreferredDrainTypes(hour: number): { types: string[]; label: string } {
  if (hour < 11) return { types: ["deep"], label: "morning deep work time" }
  if (hour < 14) return { types: ["shallow", "admin"], label: "midday communication time" }
  return { types: ["shallow", "admin"], label: "afternoon wind-down" }
}

export async function GET() {
  try {
    // Return mock data in preview mode without database
    if (isPreviewWithoutDb()) {
      console.log("[v0] Backlog/recommendations API: Using mock data (preview mode)")
      const backlogTasks = MOCK_TASKS.filter(t => t.status === "backlog").slice(0, 3)
      return NextResponse.json({
        recommendations: backlogTasks.map((t, i) => {
          const client = MOCK_CLIENTS.find(c => c.id === t.clientId)
          return {
            id: t.id,
            title: t.title,
            clientName: client?.name || "Unknown",
            clientColor: client?.color || "#6b7280",
            drainType: t.drainType,
            effortEstimate: t.effortEstimate,
            reason: i === 0 ? "Client hasn't been touched in 3 days" : "Good next candidate",
            score: 80 - i * 10,
            daysInBacklog: Math.floor(Math.random() * 10) + 1,
          }
        }),
      })
    }
    
    const db = getDb()

    // Get current time in EST
    const now = new Date()
    const estOffset = -5 * 60
    const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60000)
    const todayStart = new Date(estNow)
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date(estNow)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
    weekStart.setHours(0, 0, 0, 0)

    // Get all backlog tasks with client info
    const backlogTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        clientId: tasks.clientId,
        drainType: tasks.drainType,
        effortEstimate: tasks.effortEstimate,
        createdAt: tasks.createdAt,
        backlogEnteredAt: tasks.backlogEnteredAt,
        clientName: clients.name,
        clientColor: clients.color,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(eq(tasks.status, "backlog"))

    const allClientMemory = await db.select().from(clientMemory)
    const memoryMap = new Map(allClientMemory.map((m) => [m.clientName, m]))

    const clientLastCompletion = await db
      .select({
        clientId: tasks.clientId,
        lastCompletion: sql<Date>`MAX(${tasks.completedAt})`.as("lastCompletion"),
      })
      .from(tasks)
      .where(eq(tasks.status, "done"))
      .groupBy(tasks.clientId)

    const clientLastCompletionMap = new Map(clientLastCompletion.map((c) => [c.clientId, c.lastCompletion]))

    const weeklyClientCompletions = await db
      .select({
        clientId: tasks.clientId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, weekStart)))
      .groupBy(tasks.clientId)

    const weeklyCompletionMap = new Map(weeklyClientCompletions.map((c) => [c.clientId, Number(c.count)]))

    const todayDrainTypes = await db
      .select({
        drainType: tasks.drainType,
      })
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayStart)))

    const usedDrainTypesToday = new Set(todayDrainTypes.map((m) => m.drainType).filter(Boolean))

    // Get clients with completions today
    const todayTasks = await db
      .select({
        clientId: tasks.clientId,
        clientName: clients.name,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayStart)))

    const touchedTodayClientIds = new Set(todayTasks.map((t) => t.clientId))

    // Current hour for energy matching (EST)
    const hour = estNow.getHours()
    const { types: preferredDrainTypes, label: timeLabel } = getPreferredDrainTypes(hour)

    const scored: ScoredTask[] = backlogTasks.map((task) => {
      const clientName = task.clientName || "Unknown"
      const clientId = task.clientId

      // Calculate days in backlog (use backlogEnteredAt if available)
      const backlogDate = task.backlogEnteredAt || task.createdAt
      const daysInBacklog = Math.floor((Date.now() - new Date(backlogDate).getTime()) / (1000 * 60 * 60 * 24))

      let score = 0
      const reasons: string[] = []

      const memory = clientName ? memoryMap.get(clientName) : null
      const clientImportance = memory?.importance || "medium"
      const clientSentiment = memory?.sentiment || "neutral"

      if (clientImportance === "high") {
        score += 20
        reasons.push(`${clientName} is high priority`)
      } else if (clientImportance === "low") {
        score -= 10
      }

      if (clientSentiment === "challenging") {
        score += 15
        reasons.push(`${clientName} needs attention (concerned sentiment)`)
      }

      // 1. CLIENT COMPLETION RECENCY (weight: 25 max)
      const lastCompletion = clientId ? clientLastCompletionMap.get(clientId) : null
      if (lastCompletion) {
        const daysSinceCompletion = Math.floor(
          (Date.now() - new Date(lastCompletion).getTime()) / (1000 * 60 * 60 * 24),
        )
        if (daysSinceCompletion >= 1) {
          const recencyScore = Math.min(daysSinceCompletion * 5, 25)
          score += recencyScore
          if (daysSinceCompletion >= 3) {
            reasons.push(`${clientName} hasn't been touched in ${daysSinceCompletion} days`)
          }
        }
      } else if (clientId) {
        score += 25
        reasons.push(`${clientName} has no completions yet`)
      }

      // 2. WEEKLY CLIENT COVERAGE (weight: 20 max)
      const weeklyCount = clientId ? weeklyCompletionMap.get(clientId) || 0 : 0
      if (weeklyCount === 0) {
        score += 20
        reasons.push(`${clientName} has 0 tasks this week`)
      } else if (weeklyCount === 1) {
        score += 10
      }

      // 3. DRAIN TYPE BALANCE (weight: 15)
      if (task.drainType && !usedDrainTypesToday.has(task.drainType)) {
        score += 15
        reasons.push(`No ${task.drainType} work done today`)
      }

      // 4. ENERGY-TIME MATCH (weight: 15)
      const energyMatch = preferredDrainTypes.includes(task.drainType || "")
      if (energyMatch) {
        score += 15
        if (!reasons.some((r) => r.includes(task.drainType || ""))) {
          reasons.push(`${task.drainType} work fits ${timeLabel}`)
        }
      }

      // 5. BACKLOG AGE (weight: 10 max)
      const ageScore = Math.min(daysInBacklog, 10)
      score += ageScore
      if (daysInBacklog >= 14) {
        reasons.push(`${daysInBacklog} days in backlog`)
      }

      // 6. QUICK WIN BONUS (weight: 10)
      if (task.effortEstimate === 1) {
        score += 10
        reasons.push("Quick win to build momentum")
      }

      // 7. CLIENT ALREADY TOUCHED TODAY (penalty: -30)
      if (clientId && touchedTodayClientIds.has(clientId)) {
        score -= 30
      }

      // 8. SMALL RANDOM FACTOR (0-5)
      score += Math.random() * 5

      return {
        id: task.id,
        title: task.title,
        clientId: task.clientId,
        clientName: task.clientName,
        clientColor: task.clientColor,
        drainType: task.drainType,
        effortEstimate: task.effortEstimate,
        createdAt: task.createdAt,
        score: Math.round(score * 10) / 10,
        reason: reasons.length > 0 ? reasons[0] : "Good next candidate",
        daysInBacklog,
      }
    })

    // Sort by score, take top picks, ensure client diversity
    const sorted = scored.sort((a, b) => b.score - a.score)
    const recommendations: ScoredTask[] = []
    const usedClients = new Set<number | null>()

    for (const item of sorted) {
      if (recommendations.length >= 3) break
      if (item.clientId && usedClients.has(item.clientId)) {
        continue
      }
      recommendations.push(item)
      if (item.clientId) usedClients.add(item.clientId)
    }

    return NextResponse.json({
      recommendations: recommendations.map((r) => ({
        id: r.id,
        title: r.title,
        clientName: r.clientName,
        clientColor: r.clientColor,
        drainType: r.drainType,
        effortEstimate: r.effortEstimate,
        reason: r.reason,
        score: r.score,
        daysInBacklog: r.daysInBacklog,
      })),
    })
  } catch (error) {
    console.error("Failed to get recommendations:", error)
    return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 })
  }
}
