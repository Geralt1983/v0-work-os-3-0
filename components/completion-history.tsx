"use client"

import { useCompletionHistory } from "@/hooks/use-completion-history"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"
import { getTaskPoints, getPointsColor } from "@/lib/domain/task-types"

export function CompletionHistory() {
  const { days, isLoading } = useCompletionHistory(30)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Completion History
          </CardTitle>
          <p className="text-sm text-muted-foreground">Track your progress and patterns over time.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Skeleton for 3 days to reserve space */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="h-6 w-24 bg-muted rounded" />
                <div className="flex items-center gap-4">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-4 w-12 bg-muted rounded" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              </div>
              <div className="space-y-1">
                {[1, 2].map((j) => (
                  <div key={j} className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-4 w-16 bg-muted rounded" />
                      <div className="h-4 w-48 bg-muted rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-16 bg-muted rounded" />
                      <div className="h-4 w-12 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Completion History
        </CardTitle>
        <p className="text-sm text-muted-foreground">Track your progress and patterns over time.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {days.map((day) => (
          <div key={day.date} className="space-y-2">
            {/* Day Header */}
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-semibold text-lg">{day.displayLabel}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{day.tasks.length} tasks</span>
                <span>•</span>
                <span>{day.totalPoints} pts</span>
                <span>•</span>
                <span>{day.uniqueClients} clients</span>
              </div>
            </div>

            {/* Tasks List */}
            <div className="space-y-1">
              {day.tasks.map((task) => {
                const completedTime = task.completedAt
                  ? new Date(task.completedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : ""
                const points = getTaskPoints(task)

                return (
                  <div key={task.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">{completedTime}</span>
                      <span className="truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.client && (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: task.client.color,
                            color: task.client.color,
                          }}
                        >
                          {task.client.name}
                        </Badge>
                      )}
                      {task.drainType && (
                        <Badge variant="secondary" className="text-xs">
                          {task.drainType}
                        </Badge>
                      )}
                      <span className={`text-sm font-medium w-12 text-right ${getPointsColor(points)}`}>{points}pt</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {days.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No completed tasks in the past 30 days.</div>
        )}
      </CardContent>
    </Card>
  )
}
