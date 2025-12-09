import useSWR from "swr"

interface WeeklyGoals {
  totalMinutes: number
  movesCompleted: number
  daysElapsed: number
  daysRemaining: number
  dailyAverage: number
  projectedTotal: number
  minimumGoal: number
  idealGoal: number
  minimumPercent: number
  idealPercent: number
  paceForMinimum: number
  paceForIdeal: number
  status: "behind" | "on_track" | "minimum_met" | "ideal_hit"
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useWeeklyGoals() {
  const { data, error, isLoading, mutate } = useSWR<WeeklyGoals>("/api/metrics/week", fetcher, {
    refreshInterval: 60000,
  })

  return {
    data,
    isLoading,
    error,
    refresh: mutate,
  }
}
