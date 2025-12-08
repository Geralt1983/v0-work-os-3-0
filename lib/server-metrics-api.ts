// Server API wrapper for metrics
import { apiRequest } from "./api-client"

export interface TodayMetrics {
  targetHours: number
  currentHours: number
  percent: number
  fromBacklog: number
  clientsTouched: number
}

export interface WeeklyMetrics {
  score: number
  label: string
  hours: Array<{ day: string; h: number }>
  moves: number
  avgPerDay: number
}

export interface ClientActivity {
  client: string
  moves: number
  last: string
  sentiment: string
  priority: string
}

export interface DrainType {
  label: string
  color: string
  count: number
}

export interface ProductivityRhythm {
  label: string
  value: number
}

export interface BacklogHealth {
  client: string
  status: string
  tone: "positive" | "neutral" | "negative"
  summary: string
}

export const getTodayMetrics = (): Promise<TodayMetrics> => apiRequest<TodayMetrics>("/api/metrics/today")

export const getWeeklyMetrics = (): Promise<WeeklyMetrics> => apiRequest<WeeklyMetrics>("/api/metrics/weekly")

export const getClientActivity = (): Promise<ClientActivity[]> => apiRequest<ClientActivity[]>("/api/metrics/clients")

export const getDrainTypes = (): Promise<DrainType[]> => apiRequest<DrainType[]>("/api/metrics/drain-types")

export const getProductivity = (): Promise<ProductivityRhythm[]> =>
  apiRequest<ProductivityRhythm[]>("/api/metrics/productivity")

export const getBacklogHealth = (): Promise<BacklogHealth[]> =>
  apiRequest<BacklogHealth[]>("/api/metrics/backlog-health")

export const getAvoidedTasks = (): Promise<{ tasks: string[] }> =>
  apiRequest<{ tasks: string[] }>("/api/metrics/avoided-tasks")

export const getPatterns = (): Promise<{ patterns: string[] }> =>
  apiRequest<{ patterns: string[] }>("/api/metrics/patterns")
