import useSWR from "swr"
import { isPreviewEnvironment } from "@/lib/mock-data"

interface Recommendation {
  id: number
  title: string
  clientName: string
  clientColor: string
  drainType: string
  effortEstimate: number
  reason: string
  score: number
  daysInBacklog: number
}

interface RecommendationsResponse {
  recommendations: Recommendation[]
}

const mockRecommendations: Recommendation[] = [
  {
    id: 101,
    title: "Update quarterly projections",
    clientName: "Acme Corp",
    clientColor: "#3B82F6",
    drainType: "deep",
    effortEstimate: 45,
    reason: "Client hasn't been touched in 4 days",
    score: 85,
    daysInBacklog: 5,
  },
  {
    id: 102,
    title: "Review contract renewal",
    clientName: "TechStart",
    clientColor: "#10B981",
    drainType: "shallow",
    effortEstimate: 15,
    reason: "Quick win - 15 min task",
    score: 72,
    daysInBacklog: 3,
  },
  {
    id: 103,
    title: "Prepare presentation deck",
    clientName: "Global Media",
    clientColor: "#F59E0B",
    drainType: "deep",
    effortEstimate: 60,
    reason: "Aging task - 7 days in backlog",
    score: 68,
    daysInBacklog: 7,
  },
]

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export function useBacklogRecommendations() {
  const { data, error, isLoading, mutate } = useSWR<RecommendationsResponse>("/api/backlog/recommendations", fetcher, {
    refreshInterval: 60000,
    shouldRetryOnError: false,
  })

  const isPreview = typeof window !== "undefined" && isPreviewEnvironment()
  const recommendations = error && isPreview ? mockRecommendations : data?.recommendations || []

  return {
    recommendations,
    isLoading: isLoading && !error,
    error: isPreview ? null : error, // Hide error in preview since we have mock data
    refresh: mutate,
  }
}
