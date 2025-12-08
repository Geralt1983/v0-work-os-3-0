import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

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

export function useMetrics() {
  const {
    data: todayData,
    error: todayError,
    isLoading: todayLoading,
    mutate: mutateToday,
  } = useSWR<TodayMetrics>("/api/metrics/today", fetcher, {
    refreshInterval: 30000,
  })

  const {
    data: clientsData,
    error: clientsError,
    isLoading: clientsLoading,
  } = useSWR<ClientMetrics[]>("/api/metrics/clients", fetcher, {
    refreshInterval: 30000,
  })

  const checkMilestone = async () => {
    try {
      await fetch("/api/notifications/milestone", { method: "POST" })
      mutateToday() // Refresh metrics after milestone check
    } catch (error) {
      console.error("Failed to check milestone:", error)
    }
  }

  return {
    today: todayData,
    clients: clientsData || [],
    isLoading: todayLoading || clientsLoading,
    error: todayError || clientsError,
    checkMilestone,
    refresh: mutateToday,
  }
}
