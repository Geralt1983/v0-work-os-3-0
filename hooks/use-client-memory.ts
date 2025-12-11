import useSWR from "swr"

export interface ClientMemory {
  clientId: number
  clientName: string
  color: string | null
  tier: "active" | "maintenance" | "dormant"
  sentiment: "positive" | "neutral" | "challenging"
  importance: "high" | "medium" | "low"
  notes: string
  avoidanceScore: number
  preferredWorkTime: string | null
  movesThisWeek: number
  lastCompletedAt: string | null
  daysSinceActivity: number | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`)
  }
  return res.json()
}

export function useClientMemory() {
  const { data, error, isLoading, mutate } = useSWR<ClientMemory[]>("/api/client-memory", fetcher, {
    refreshInterval: 30000,
  })

  const updateClientMemory = async (clientName: string, updates: Partial<ClientMemory>) => {
    try {
      const res = await fetch("/api/client-memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, ...updates }),
      })

      if (!res.ok) throw new Error("Failed to update")

      // Revalidate data
      mutate()
      return true
    } catch (err) {
      console.error("Failed to update client memory:", err)
      return false
    }
  }

  return {
    clients: data || [],
    isLoading,
    error: error ? String(error) : null,
    updateClientMemory,
    refresh: mutate,
  }
}
