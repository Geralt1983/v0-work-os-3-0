import useSWR from "swr"

interface WeeklyGoals {
  totalPoints: number
  tasksCompleted: number
  workdaysPassed: number
  workdaysRemaining: number
  daysRemaining: number
  dailyAveragePoints: number
  projectedPoints: number
  minimumGoal: number
  idealGoal: number
  minimumPercent: number
  idealPercent: number
  pacePointsNeeded: number
  pacePointsForTarget: number
  status: "behind" | "on_track" | "minimum_met" | "ideal_hit" | "week_complete"
  isWorkday: boolean
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
