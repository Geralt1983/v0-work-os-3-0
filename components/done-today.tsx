"use client"

import { useTasks, type Task } from "@/hooks/use-tasks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { useState, memo, useCallback } from "react"
import { getTaskPoints, getPointsColor } from "@/lib/domain/task-types"

// Memoized task item to prevent re-renders when other tasks change
const TaskItem = memo(function TaskItem({
  task,
  formatTime,
}: {
  task: Task
  formatTime: (date: number) => string
}) {
  const points = getTaskPoints(task)

  return (
    <div
      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-emerald-500/10 transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xs text-muted-foreground w-16 shrink-0">{formatTime(task.completedAt!)}</span>
        <span className="truncate text-sm text-foreground">{task.title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant="outline"
          className="text-xs"
          style={{
            borderColor: task.clientColor,
            color: task.clientColor,
          }}
        >
          {task.client}
        </Badge>
        <span className={`text-xs font-medium w-8 text-right ${getPointsColor(points)}`}>
          {points}pt
        </span>
      </div>
    </div>
  )
})

export function DoneToday() {
  const { tasks } = useTasks()
  const [expanded, setExpanded] = useState(true)

  // Filter to today's completed moves
  const today = new Date().toDateString()
  const doneTodayTasks = tasks
    .filter((m) => {
      if (m.status !== "done" || !m.completedAt) return false
      return new Date(m.completedAt).toDateString() === today
    })
    .sort((a, b) => {
      const aTime = new Date(a.completedAt!).getTime()
      const bTime = new Date(b.completedAt!).getTime()
      return bTime - aTime // Most recent first
    })

  const totalPoints = doneTodayTasks.reduce((sum, t) => sum + getTaskPoints(t), 0)

  // Hook must be called before any conditional returns
  const formatTime = useCallback((date: number) => {
    return new Date(date)
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase()
  }, [])

  if (doneTodayTasks.length === 0) {
    return (
      <Card className="border-dashed border-border/50 bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5" />
            <span>No tasks completed yet today. Let's change that!</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-emerald-500/30 bg-emerald-950/20">
      <CardHeader className="pb-2">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full">
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Done Today
            <Badge variant="secondary" className="ml-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              {doneTodayTasks.length} tasks &bull; {totalPoints} pts
            </Badge>
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-1">
            {doneTodayTasks.map((task) => (
              <TaskItem key={task.id} task={task} formatTime={formatTime} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
