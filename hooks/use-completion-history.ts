import useSWR from "swr"

interface CompletedTask {
  id: number
  title: string
  completedAt: Date | null
  effortActual: number | null
  effortEstimate: number | null
  pointsFinal: number | null
  pointsAiGuess: number | null
  drainType: string | null
  client: {
    id: number
    name: string
    color: string
  } | null
}

interface DayGroup {
  date: string
  displayLabel: string
  tasks: CompletedTask[]
  totalPoints: number
  uniqueClients: number
}

interface CompletionHistoryResponse {
  days: DayGroup[]
  timezone: string
  totalDays: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useCompletionHistory(daysBack = 30) {
  // Detect user's timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const { data, error, isLoading, mutate } = useSWR<CompletionHistoryResponse>(
    `/api/metrics/completion-history?days=${daysBack}&timezone=${timezone}`,
    fetcher,
    { refreshInterval: 30000 },
  )

  return {
    days: data?.days || [],
    timezone: data?.timezone,
    totalDays: data?.totalDays || 0,
    isLoading,
    error,
    refresh: mutate,
  }
}
