import useSWR from "swr"

interface HistoryMove {
  id: number
  title: string
  clientName: string
  clientColor: string
  drainType: string
  effortEstimate: number
  completedAt: string
}

interface TimelineDay {
  date: string
  displayLabel: string | null // Added displayLabel from API
  moves: HistoryMove[]
  totalMinutes: number
  clientsTouched: string[]
}

interface HeatmapDay {
  date: string
  count: number
  minutes: number
  level: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useMoveHistory(days = 30, clientId?: number) {
  const timezone = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York"

  const url = clientId
    ? `/api/moves/history?days=${days}&clientId=${clientId}&timezone=${encodeURIComponent(timezone)}`
    : `/api/moves/history?days=${days}&timezone=${encodeURIComponent(timezone)}`

  const { data, error, isLoading } = useSWR<{ timeline: TimelineDay[] }>(url, fetcher)

  return {
    timeline: data?.timeline || [],
    isLoading,
    error,
  }
}

export function useHeatmap(weeks = 12) {
  const timezone = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York"

  const { data, error, isLoading } = useSWR<{ heatmap: HeatmapDay[] }>(
    `/api/moves/heatmap?weeks=${weeks}&timezone=${encodeURIComponent(timezone)}`,
    fetcher,
  )

  return {
    heatmap: data?.heatmap || [],
    isLoading,
    error,
  }
}
