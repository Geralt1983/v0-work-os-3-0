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
  const url = clientId ? `/api/moves/history?days=${days}&clientId=${clientId}` : `/api/moves/history?days=${days}`

  const { data, error, isLoading } = useSWR<{ timeline: TimelineDay[] }>(url, fetcher)

  return {
    timeline: data?.timeline || [],
    isLoading,
    error,
  }
}

export function useHeatmap(weeks = 12) {
  const { data, error, isLoading } = useSWR<{ heatmap: HeatmapDay[] }>(`/api/moves/heatmap?weeks=${weeks}`, fetcher)

  return {
    heatmap: data?.heatmap || [],
    isLoading,
    error,
  }
}
