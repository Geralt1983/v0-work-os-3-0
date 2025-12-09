"use client"

import { useHeatmap } from "@/hooks/use-move-history"
import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Flame } from "lucide-react"
import { cn } from "@/lib/utils"

export function CompletionHeatmap() {
  const isMobile = useIsMobile()
  const { heatmap, isLoading } = useHeatmap(isMobile ? 2 : 12) // 14 days on mobile, 84 on desktop

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">Loading activity...</CardContent>
      </Card>
    )
  }

  // Calculate streak
  let currentStreak = 0
  for (let i = heatmap.length - 1; i >= 0; i--) {
    if (heatmap[i].count > 0) {
      currentStreak++
    } else {
      break
    }
  }

  // Total stats
  const totalMoves = heatmap.reduce((sum, d) => sum + d.count, 0)
  const totalMinutes = heatmap.reduce((sum, d) => sum + d.minutes, 0)
  const activeDays = heatmap.filter((d) => d.count > 0).length

  const levelColors = [
    "bg-muted/50", // 0 - no activity
    "bg-emerald-900", // 1 - <50%
    "bg-emerald-700", // 2 - 50-75%
    "bg-emerald-500", // 3 - 75-100%
    "bg-emerald-400", // 4 - 100%+
  ]

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const getMobileDayLabel = (dateStr: string, index: number) => {
    const today = new Date().toISOString().split("T")[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]

    if (dateStr === today) return "Today"
    if (dateStr === yesterday) return "Yest"

    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)
  }

  if (isMobile) {
    const DAILY_GOAL = 180
    const last14Days = heatmap.slice(-14).reverse() // Most recent first

    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-orange-500" />
            Activity
          </CardTitle>
          {/* Stats stacked below title on mobile */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            <span>{totalMoves} moves</span>
            <span>{Math.round(totalMinutes / 60)}h total</span>
            <span>{activeDays} active days</span>
            {currentStreak > 0 && <span className="text-orange-500 font-medium">{currentStreak} day streak</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {last14Days.map((day, index) => {
            const percentage = Math.min((day.minutes / DAILY_GOAL) * 100, 100)
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
                  {day.minutes > 0 ? `${day.minutes}m` : "-"}
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  // Desktop variant - GitHub-style grid
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
            <span>{totalMoves} moves</span>
            <span>{Math.round(totalMinutes / 60)}h total</span>
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
                          {day.count} moves &bull; {day.minutes} min
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

        {/* Legend */}
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
