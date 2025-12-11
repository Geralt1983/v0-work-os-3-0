import useSWR from "swr"
import { isPreviewEnvironment, MOCK_MOVES, MOCK_CLIENTS } from "@/lib/mock-data"

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

function getMockGroupedBacklog(): GroupedBacklogResponse {
  const backlogMoves = MOCK_MOVES.filter((m) => m.status === "backlog")

  const groupsByClient: Record<number, ClientGroup> = {}

  for (const move of backlogMoves) {
    const client = MOCK_CLIENTS.find((c) => c.id === move.clientId)
    if (!client) continue

    if (!groupsByClient[move.clientId]) {
      groupsByClient[move.clientId] = {
        clientId: client.id,
        clientName: client.name,
        clientColor: client.color,
        staleDays: 0,
        touchedToday: false,
        tasks: [],
      }
    }

    groupsByClient[move.clientId].tasks.push({
      id: move.id,
      title: move.title,
      drainType: move.drainType || null,
      effortEstimate: move.effortEstimate || 2,
      daysInBacklog: Math.floor(Math.random() * 10),
      decayStatus: "normal",
    })
  }

  const groups = Object.values(groupsByClient)
  return {
    groups,
    totalTasks: backlogMoves.length,
  }
}

const fetcher = async (url: string): Promise<GroupedBacklogResponse> => {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`API error ${res.status}`)
    }
    return res.json()
  } catch (error) {
    console.log("[v0] useGroupedBacklog: API error, will use mock data if in preview", error)
    if (isPreviewEnvironment()) {
      console.log("[v0] useGroupedBacklog: Using mock data in preview environment")
      return getMockGroupedBacklog()
    }
    throw error
  }
}

export function useGroupedBacklog() {
  const { data, error, isLoading, mutate } = useSWR<GroupedBacklogResponse>("/api/backlog/grouped", fetcher, {
    refreshInterval: 30000,
  })

  const finalData = data || (isPreviewEnvironment() ? getMockGroupedBacklog() : undefined)

  console.log("[v0] GroupedBacklog render:", {
    groups: finalData?.groups?.length || 0,
    totalTasks: finalData?.totalTasks || 0,
    isLoading,
    error: error ? { message: error.message } : null,
  })

  return {
    groups: finalData?.groups || [],
    totalTasks: finalData?.totalTasks || 0,
    isLoading,
    error: isPreviewEnvironment() ? null : error, // Don't show error in preview
    refresh: mutate,
  }
}
