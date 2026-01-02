"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { useTasks } from "@/hooks/use-tasks"
import {
  getTaskPoints,
  DAILY_TARGET_POINTS,
  getPointsProgress,
  VALUE_TIER_CONFIG,
  type ValueTier
} from "@/lib/domain/task-types"
import { isRealClient } from "@/lib/constants"
import { AlertTriangle, Trophy, Target, TrendingUp, Palmtree } from "lucide-react"
import { motion } from "framer-motion"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface DailyProgressBarProps {
  className?: string
}

export function DailyProgressBar({ className }: DailyProgressBarProps) {
  const { tasks } = useTasks()
  const { data: holidayData } = useSWR("/api/holidays", fetcher)

  const isHoliday = holidayData?.isTodayHoliday ?? false
  const holidayInfo = holidayData?.todayHolidayInfo

  // Calculate today's completed tasks and points
  const { pointsEarned, completedCount, staleClients } = useMemo(() => {
    const today = new Date().toDateString()

    const todayCompleted = tasks.filter((t) => {
      if (t.status !== "done" || !t.completedAt) return false
      return new Date(t.completedAt).toDateString() === today
    })

    const points = todayCompleted.reduce((sum, t) => sum + getTaskPoints(t), 0)

    // Find stale clients (5+ days without activity)
    // For now, calculate from task data - later this can come from the staleness API
    // Filter out non-client categories (Revenue, General Admin)
    const clientLastActivity = new Map<string, number>()
    tasks.forEach((t) => {
      if (t.status === "done" && t.completedAt && t.client && isRealClient(t.client)) {
        const existing = clientLastActivity.get(t.client) || 0
        const taskTime = new Date(t.completedAt).getTime()
        if (taskTime > existing) {
          clientLastActivity.set(t.client, taskTime)
        }
      }
    })

    const now = Date.now()
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
    const stale: string[] = []
    clientLastActivity.forEach((lastActivity, clientName) => {
      if (now - lastActivity > fiveDaysMs) {
        stale.push(clientName)
      }
    })

    return {
      pointsEarned: points,
      completedCount: todayCompleted.length,
      staleClients: stale,
    }
  }, [tasks])

  const progressPercent = getPointsProgress(pointsEarned, DAILY_TARGET_POINTS)
  const isComplete = pointsEarned >= DAILY_TARGET_POINTS
  // On holidays, stale blockers don't apply
  const hasStaleBlockers = !isHoliday && staleClients.length > 0
  const canCompleteDay = isHoliday || (isComplete && !hasStaleBlockers)

  // Determine progress bar color
  const getProgressColor = () => {
    if (isHoliday) return "from-cyan-500 to-teal-500"
    if (hasStaleBlockers) return "from-amber-500 to-amber-600"
    if (isComplete) return "from-emerald-500 to-emerald-600"
    if (progressPercent >= 75) return "from-blue-500 to-indigo-500"
    if (progressPercent >= 50) return "from-indigo-500 to-violet-500"
    return "from-violet-500 to-purple-500"
  }

  // Determine status message
  const getStatusMessage = () => {
    if (isHoliday) return holidayInfo?.description ? `🏝️ ${holidayInfo.description}` : "🏝️ Holiday Mode"
    if (canCompleteDay) return "Day complete! 🎉"
    if (hasStaleBlockers) return `Stale wall: ${staleClients.length} client${staleClients.length > 1 ? "s" : ""} need attention`
    if (isComplete) return "Target reached!"
    const remaining = DAILY_TARGET_POINTS - pointsEarned
    return `${remaining} points to go`
  }

  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isHoliday ? (
            <Palmtree className="h-5 w-5 text-cyan-400" />
          ) : canCompleteDay ? (
            <Trophy className="h-5 w-5 text-emerald-400" />
          ) : hasStaleBlockers ? (
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          ) : (
            <Target className="h-5 w-5 text-indigo-400" />
          )}
          <span className="font-semibold text-zinc-100">
            {isHoliday ? "Holiday" : "Daily Progress"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${
            isHoliday ? "text-cyan-400" :
            canCompleteDay ? "text-emerald-400" :
            hasStaleBlockers ? "text-amber-400" :
            "text-zinc-100"
          }`}>
            {isHoliday ? "Off" : pointsEarned}
          </span>
          {!isHoliday && (
            <span className="text-zinc-500">/ {DAILY_TARGET_POINTS} pts</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: isHoliday ? "100%" : `${Math.min(progressPercent, 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getProgressColor()} rounded-full`}
        />
        {/* Target marker - hide on holidays */}
        {!isHoliday && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-zinc-600"
            style={{ left: "100%" }}
          />
        )}
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-sm ${
          isHoliday ? "text-cyan-400" :
          canCompleteDay ? "text-emerald-400" :
          hasStaleBlockers ? "text-amber-400" :
          "text-zinc-400"
        }`}>
          {getStatusMessage()}
        </span>
        {!isHoliday && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <TrendingUp className="h-3 w-3" />
            {completedCount} task{completedCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Stale wall warning */}
      {hasStaleBlockers && (
        <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-200 font-medium">
                Can't complete day until these clients get attention:
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {staleClients.map((client) => (
                  <span
                    key={client}
                    className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300"
                  >
                    {client}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact version for header display
 */
export function DailyProgressPill({ className }: { className?: string }) {
  const { tasks } = useTasks()

  const pointsEarned = useMemo(() => {
    const today = new Date().toDateString()
    return tasks
      .filter((t) => {
        if (t.status !== "done" || !t.completedAt) return false
        return new Date(t.completedAt).toDateString() === today
      })
      .reduce((sum, t) => sum + getTaskPoints(t), 0)
  }, [tasks])

  const progressPercent = getPointsProgress(pointsEarned, DAILY_TARGET_POINTS)
  const isComplete = pointsEarned >= DAILY_TARGET_POINTS

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700">
        {isComplete ? (
          <Trophy className="h-4 w-4 text-emerald-400" />
        ) : (
          <Target className="h-4 w-4 text-indigo-400" />
        )}
        <span className={`text-sm font-semibold ${isComplete ? "text-emerald-400" : "text-zinc-100"}`}>
          {pointsEarned}
        </span>
        <span className="text-sm text-zinc-500">/ {DAILY_TARGET_POINTS}</span>
      </div>
      {/* Mini progress bar */}
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isComplete ? "bg-emerald-500" : "bg-indigo-500"
          }`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
    </div>
  )
}
