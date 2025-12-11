"use client"

import { useWeeklyGoals } from "@/hooks/use-weekly-goals"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target, TrendingUp, Clock, CheckCircle2 } from "lucide-react"

function getStatusBadge(status: string) {
  switch (status) {
    case "ideal_hit":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ideal Hit</Badge>
    case "minimum_met":
      return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Minimum Met</Badge>
    case "on_track":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">On Track</Badge>
    case "behind":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Behind</Badge>
    default:
      return null
  }
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function WeeklyGoals() {
  const { data, isLoading } = useWeeklyGoals()

  if (isLoading || !data) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-cyan-500" />
            Weekly Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-8 bg-zinc-800 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-cyan-500" />
            Weekly Goals
          </CardTitle>
          {getStatusBadge(data.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bars */}
        <div className="space-y-3">
          {/* Minimum goal (15h) */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Minimum (15h)</span>
              <span className="text-foreground font-medium">{data.minimumPercent}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${data.minimumPercent}%` }}
              />
            </div>
          </div>

          {/* Ideal goal (20h) */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Ideal (20h)</span>
              <span className="text-foreground font-medium">{data.idealPercent}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${data.idealPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{formatHours(data.totalMinutes)}</div>
              <div className="text-[10px] text-muted-foreground">this week</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{data.movesCompleted}</div>
              <div className="text-[10px] text-muted-foreground">moves done</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{formatHours(data.dailyAverage)}</div>
              <div className="text-[10px] text-muted-foreground">daily avg</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{formatHours(data.paceForMinimum)}</div>
              <div className="text-[10px] text-muted-foreground">pace needed</div>
            </div>
          </div>
        </div>

        {/* Projection */}
        {data.daysRemaining > 0 ? (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/30">
            Projected: {formatHours(data.projectedTotal)} by Friday ({data.daysRemaining} day
            {data.daysRemaining !== 1 ? "s" : ""} left)
          </div>
        ) : data.status === "week_complete" || !data.isWorkday ? (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/30">
            Week complete - resets Monday
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
