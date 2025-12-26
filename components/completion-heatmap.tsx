"use client"

import { useHeatmap } from "@/hooks/use-task-history"
import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { DAILY_TARGET_POINTS } from "@/lib/constants"

function isWeekday(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00") // Add noon to avoid timezone shifts
  const day = date.getDay()
  return day !== 0 && day !== 6 // 0 = Sunday, 6 = Saturday
}

export function CompletionHeatmap() {
  const isMobile = useIsMobile()
  const { heatmap, isLoading } = useHeatmap(isMobile ? 2 : 12)

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">Loading activity...</CardContent>
      </Card>
    )
  }

  let currentStreak = 0
  for (let i = heatmap.length - 1; i >= 0; i--) {
    const day = heatmap[i]
    // Skip weekends for streak calculation
    if (!isWeekday(day.date)) continue
    // Check if weekday has 18+ points (target)
    if (day.points >= DAILY_TARGET_POINTS) {
      currentStreak++
    } else {
      break
    }
  }

  const totalTasks = heatmap.reduce((sum, d) => sum + d.count, 0)
  const totalPoints = heatmap.reduce((sum, d) => sum + d.points, 0)
  const activeDays = heatmap.filter((d) => d.count > 0).length

  const levelColors = ["bg-muted/50", "bg-emerald-900", "bg-emerald-700", "bg-emerald-500", "bg-emerald-400"]

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const getMobileDayLabel = (dateStr: string, index: number) => {
    const now = new Date()
    const today = now.toLocaleDateString("en-CA") // YYYY-MM-DD in local timezone
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString("en-CA")

    if (dateStr === today) return "Today"
    if (dateStr === yesterday) return "Yest"

    const date = new Date(dateStr + "T12:00:00") // Add noon time to avoid timezone shifts
    return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)
  }

  if (isMobile) {
    const last14Days = heatmap.slice(-14).reverse()

    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-orange-500" />
            Activity
          </CardTitle>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            <span>{totalTasks} tasks</span>
            <span>{totalPoints} pts total</span>
            <span>{activeDays} active days</span>
            {currentStreak > 0 && <span className="text-orange-500 font-medium">{currentStreak} day streak</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {last14Days.map((day, index) => {
            const percentage = Math.min((day.points / DAILY_TARGET_POINTS) * 100, 100)
            return (
              <div key={day.date} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10 shrink-0">
                  {getMobileDayLabel(day.date, index)}
                </span>
                <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", levelColors[day.level])}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {day.points > 0 ? `${day.points}pt` : "-"}
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  const weeks: (typeof heatmap)[] = []
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7))
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-orange-500" />
            Activity
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{totalTasks} tasks</span>
            <span>{totalPoints} pts total</span>
            <span>{activeDays} active days</span>
            {currentStreak > 0 && <span className="text-orange-500 font-medium">{currentStreak} day streak</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((day) => (
                  <Tooltip key={day.date}>
                    <TooltipTrigger>
                      <div className={cn("w-3 h-3 rounded-sm transition-colors", levelColors[day.level])} />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{formatDate(day.date)}</p>
                      {day.count > 0 ? (
                        <p className="text-xs">
                          {day.count} tasks &bull; {day.points} pts
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No activity</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </TooltipProvider>

        <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
          <span>Less</span>
          {levelColors.map((color, i) => (
            <div key={i} className={cn("w-3 h-3 rounded-sm", color)} />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
