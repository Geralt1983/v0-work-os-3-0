import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export interface TodayMetrics {
  completedCount: number
  earnedMinutes: number
  targetMinutes: number
  paceStatus: "on_track" | "behind"
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

  return {
    today: todayData,
    clients: clientsData || [],
    isLoading: todayLoading || clientsLoading,
    error: todayError || clientsError,
  }
}
