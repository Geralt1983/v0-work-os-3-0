import useSWR from "swr"

interface BacklogTask {
  id: number
  title: string
  drainType: string | null
  effortEstimate: number | null
  daysInBacklog: number
  decayStatus: "normal" | "aging" | "stale" | "critical"
}

interface ClientGroup {
  clientId: number
  clientName: string
  clientColor: string
  staleDays: number
  touchedToday: boolean
  tasks: BacklogTask[]
}

interface GroupedBacklogResponse {
  groups: ClientGroup[]
  totalTasks: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useGroupedBacklog() {
  const { data, error, isLoading, mutate } = useSWR<GroupedBacklogResponse>("/api/backlog/grouped", fetcher, {
    refreshInterval: 30000,
  })

  return {
    groups: data?.groups || [],
    totalTasks: data?.totalTasks || 0,
    isLoading,
    error,
    refresh: mutate,
  }
}
