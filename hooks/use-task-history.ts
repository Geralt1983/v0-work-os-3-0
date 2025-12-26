import useSWR from "swr"

interface HistoryTask {
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
  displayLabel: string | null
  tasks: HistoryTask[]
  totalPoints: number
  clientsTouched: string[]
}

interface HeatmapDay {
  date: string
  count: number
  points: number
  level: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useTaskHistory(days = 30, clientId?: number) {
  const timezone = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York"

  const url = clientId
    ? `/api/tasks/history?days=${days}&clientId=${clientId}&timezone=${encodeURIComponent(timezone)}`
    : `/api/tasks/history?days=${days}&timezone=${encodeURIComponent(timezone)}`

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
    `/api/tasks/heatmap?weeks=${weeks}&timezone=${encodeURIComponent(timezone)}`,
    fetcher,
  )

  return {
    heatmap: data?.heatmap || [],
    isLoading,
    error,
  }
}
