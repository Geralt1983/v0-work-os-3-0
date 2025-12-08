"use client"

import useSWR from "swr"
import { isPreviewEnvironment } from "@/lib/mock-data"

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
  paceStatus: "on_track" | "behind"
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
}

export interface ClientMetrics {
  clientId: number
  clientName: string
  totalMoves: number
  completedMoves: number
  activeMoves: number
  daysSinceLastMove: number | null
  isStale: boolean
}

let previewCompletedMoves: { id: number; completedAt: Date; effortEstimate: number }[] = []

export function trackCompletedMove(move: { id: number; effortEstimate?: number }) {
  previewCompletedMoves.push({
    id: move.id,
    completedAt: new Date(),
    effortEstimate: move.effortEstimate || 2,
  })
}

export function clearPreviewCompletedMoves() {
  previewCompletedMoves = []
}

function calculatePreviewMomentum(): TodayMetrics["momentum"] {
  if (previewCompletedMoves.length === 0) {
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
  const actualMinutes = previewCompletedMoves.reduce((sum, m) => sum + m.effortEstimate * 20, 0)

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
  const earnedMinutes = previewCompletedMoves.reduce((sum, m) => sum + m.effortEstimate * 20, 0)
  const targetMinutes = 180
  const percent = Math.round((earnedMinutes / targetMinutes) * 100)

  return {
    completedCount: previewCompletedMoves.length,
    earnedMinutes,
    targetMinutes,
    percent,
    paceStatus: percent >= 100 ? "on_track" : "behind",
    momentum: calculatePreviewMomentum(),
    streak: 0,
  }
}

function getPreviewClientMetrics(): ClientMetrics[] {
  return [
    {
      clientId: 1,
      clientName: "Acme Corp",
      totalMoves: 5,
      completedMoves: 2,
      activeMoves: 3,
      daysSinceLastMove: 1,
      isStale: false,
    },
    {
      clientId: 2,
      clientName: "TechStart",
      totalMoves: 4,
      completedMoves: 1,
      activeMoves: 3,
      daysSinceLastMove: 0,
      isStale: false,
    },
    {
      clientId: 3,
      clientName: "Global Media",
      totalMoves: 3,
      completedMoves: 0,
      activeMoves: 3,
      daysSinceLastMove: 3,
      isStale: true,
    },
    {
      clientId: 4,
      clientName: "Internal",
      totalMoves: 2,
      completedMoves: 1,
      activeMoves: 1,
      daysSinceLastMove: 0,
      isStale: false,
    },
    {
      clientId: 5,
      clientName: "Side Project",
      totalMoves: 1,
      completedMoves: 0,
      activeMoves: 1,
      daysSinceLastMove: 5,
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
    refreshInterval: 30000,
    onError: () => {}, // Suppress error logging, we handle it below
  })

  const {
    data: clientsData,
    error: clientsError,
    isLoading: clientsLoading,
    mutate: mutateClients,
  } = useSWR<ClientMetrics[]>("/api/metrics/clients", fetcher, {
    refreshInterval: 30000,
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
