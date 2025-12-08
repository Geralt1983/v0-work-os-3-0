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
    trend: "rising" | "falling" | "steady"
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

function calculatePreviewMomentum(): { score: number; trend: "rising" | "falling" | "steady" } {
  if (previewCompletedMoves.length === 0) return { score: 0, trend: "steady" }

  const sorted = [...previewCompletedMoves].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())

  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prevTime = sorted[i - 1].completedAt.getTime()
    const currTime = sorted[i].completedAt.getTime()
    gaps.push((currTime - prevTime) / (1000 * 60)) // Gap in minutes
  }

  if (gaps.length === 0) return { score: 50, trend: "steady" }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const score = Math.max(0, Math.min(100, Math.round(100 - (avgGap / 120) * 100)))

  const midpoint = Math.floor(gaps.length / 2)
  if (midpoint > 0) {
    const firstHalf = gaps.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint
    const secondHalf = gaps.slice(midpoint).reduce((a, b) => a + b, 0) / (gaps.length - midpoint)

    if (secondHalf < firstHalf * 0.8) return { score, trend: "rising" }
    if (secondHalf > firstHalf * 1.2) return { score, trend: "falling" }
  }

  return { score, trend: "steady" }
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
