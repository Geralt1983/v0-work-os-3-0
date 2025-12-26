"use client"

import useSWR from "swr"
import { isPreviewEnvironment } from "@/lib/mock-data"
import { SWR_CONFIG } from "@/lib/fetch-utils"
import { MINUTES_PER_EFFORT, DAILY_TARGET_MINUTES } from "@/lib/domain"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error ${res.status}`)
  }
  return res.json()
}

export interface TodayMetrics {
  completedCount: number
  earnedMinutes: number
  targetMinutes: number
  percent: number
  paceStatus: "ahead" | "on_track" | "behind" | "minimum_only"
  momentum: {
    score: number
    percent: number
    status: "crushing" | "on_track" | "behind" | "stalled"
    label: string
    expectedByNow: number
    actualMinutes: number
    dayProgress: number
  }
  streak: number
  clientsTouchedToday: number
  totalExternalClients: number
}

export interface ClientMetrics {
  clientId: number
  clientName: string
  totalTasks: number
  completedTasks: number
  activeTasks: number
  daysSinceLastTask: number | null
  isStale: boolean
}

let previewCompletedTasks: { id: number; completedAt: Date; effortEstimate: number }[] = []

export function trackCompletedTask(task: { id: number; effortEstimate?: number }) {
  previewCompletedTasks.push({
    id: task.id,
    completedAt: new Date(),
    effortEstimate: task.effortEstimate || 2,
  })
}

// Legacy alias
export const trackCompletedMove = trackCompletedTask

export function clearPreviewCompletedTasks() {
  previewCompletedTasks = []
}

// Legacy alias
export const clearPreviewCompletedMoves = clearPreviewCompletedTasks

function calculatePreviewMomentum(): TodayMetrics["momentum"] {
  if (previewCompletedTasks.length === 0) {
    return {
      score: 0,
      percent: 0,
      status: "stalled",
      label: "Stalled",
      expectedByNow: 0,
      actualMinutes: 0,
      dayProgress: 0,
    }
  }

  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()

  // Calculate day progress (9am-6pm = 9 hours)
  const workdayStart = 9
  const workdayEnd = 18
  const currentHour = hour + minute / 60

  let dayProgress = 0
  if (currentHour >= workdayEnd) {
    dayProgress = 100
  } else if (currentHour > workdayStart) {
    dayProgress = Math.round(((currentHour - workdayStart) / (workdayEnd - workdayStart)) * 100)
  }

  const targetMinutes = 180
  const expectedByNow = Math.round((dayProgress / 100) * targetMinutes)
  const actualMinutes = previewCompletedTasks.reduce((sum, t) => sum + t.effortEstimate * 20, 0)

  // Score based on actual vs expected
  const score = expectedByNow > 0 ? Math.round((actualMinutes / expectedByNow) * 100) : actualMinutes > 0 ? 100 : 0

  // Determine status
  let status: "crushing" | "on_track" | "behind" | "stalled" = "stalled"
  let label = "Stalled"

  if (actualMinutes === 0) {
    status = "stalled"
    label = "Stalled"
  } else if (score >= 120) {
    status = "crushing"
    label = "Crushing it"
  } else if (score >= 80) {
    status = "on_track"
    label = "On track"
  } else {
    status = "behind"
    label = "Behind pace"
  }

  return {
    score,
    percent: Math.round((actualMinutes / targetMinutes) * 100),
    status,
    label,
    expectedByNow,
    actualMinutes,
    dayProgress,
  }
}

function getPreviewMetrics(): TodayMetrics {
  const earnedMinutes = previewCompletedTasks.reduce((sum, t) => sum + t.effortEstimate * MINUTES_PER_EFFORT, 0)
  const targetMinutes = DAILY_TARGET_MINUTES
  const percent = Math.round((earnedMinutes / targetMinutes) * 100)

  return {
    completedCount: previewCompletedTasks.length,
    earnedMinutes,
    targetMinutes,
    percent,
    paceStatus: percent >= 100 ? "on_track" : "behind",
    momentum: calculatePreviewMomentum(),
    streak: 0,
    clientsTouchedToday: 0,
    totalExternalClients: 4,
  }
}

function getPreviewClientMetrics(): ClientMetrics[] {
  return [
    {
      clientId: 1,
      clientName: "Acme Corp",
      totalTasks: 5,
      completedTasks: 2,
      activeTasks: 3,
      daysSinceLastTask: 1,
      isStale: false,
    },
    {
      clientId: 2,
      clientName: "TechStart",
      totalTasks: 4,
      completedTasks: 1,
      activeTasks: 3,
      daysSinceLastTask: 0,
      isStale: false,
    },
    {
      clientId: 3,
      clientName: "Global Media",
      totalTasks: 3,
      completedTasks: 0,
      activeTasks: 3,
      daysSinceLastTask: 3,
      isStale: true,
    },
    {
      clientId: 4,
      clientName: "Internal",
      totalTasks: 2,
      completedTasks: 1,
      activeTasks: 1,
      daysSinceLastTask: 0,
      isStale: false,
    },
    {
      clientId: 5,
      clientName: "Side Project",
      totalTasks: 1,
      completedTasks: 0,
      activeTasks: 1,
      daysSinceLastTask: 5,
      isStale: true,
    },
  ]
}

export function useMetrics() {
  const {
    data: todayData,
    error: todayError,
    isLoading: todayLoading,
    mutate: mutateToday,
  } = useSWR<TodayMetrics>("/api/metrics/today", fetcher, {
    ...SWR_CONFIG.default,
    onError: () => {},
  })

  const {
    data: clientsData,
    error: clientsError,
    isLoading: clientsLoading,
    mutate: mutateClients,
  } = useSWR<ClientMetrics[]>("/api/metrics/clients", fetcher, {
    ...SWR_CONFIG.default,
    onError: () => {},
  })

  const isPreview = typeof window !== "undefined" && isPreviewEnvironment()

  const today = todayError && isPreview ? getPreviewMetrics() : todayData
  const clients = clientsError && isPreview ? getPreviewClientMetrics() : clientsData || []

  const checkMilestone = async () => {
    try {
      await fetch("/api/notifications/milestone", { method: "POST" })
      mutateToday()
    } catch (error) {
      console.error("Failed to check milestone:", error)
    }
  }

  const refresh = () => {
    if (isPreview && todayError) {
      // In preview mode with failed API, trigger a re-render by mutating with new data
      mutateToday(getPreviewMetrics(), false)
    } else {
      mutateToday()
      mutateClients()
    }
  }

  return {
    today,
    clients,
    isLoading: todayLoading || clientsLoading,
    error: !isPreview ? todayError || clientsError : null,
    checkMilestone,
    refresh,
  }
}
