"use client"

import { useMoves } from "@/hooks/use-moves"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

export function DoneToday() {
  const { moves } = useMoves()
  const [expanded, setExpanded] = useState(true)

  // Filter to today's completed moves
  const today = new Date().toDateString()
  const doneTodayMoves = moves
    .filter((m) => {
      if (m.status !== "done" || !m.completedAt) return false
      return new Date(m.completedAt).toDateString() === today
    })
    .sort((a, b) => {
      const aTime = new Date(a.completedAt!).getTime()
      const bTime = new Date(b.completedAt!).getTime()
      return bTime - aTime // Most recent first
    })

  const totalMinutes = doneTodayMoves.reduce((sum, m) => sum + (m.effortEstimate || 2) * 20, 0)

  if (doneTodayMoves.length === 0) {
    return (
      <Card className="border-dashed border-border/50 bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5" />
            <span>No moves completed yet today. Let's change that!</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatTime = (date: number) => {
    return new Date(date)
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase()
  }

  return (
    <Card className="border-emerald-500/30 bg-emerald-950/20">
      <CardHeader className="pb-2">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full">
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Done Today
            <Badge variant="secondary" className="ml-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              {doneTodayMoves.length} moves &bull; {totalMinutes} min
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
            {doneTodayMoves.map((move) => (
              <div
                key={move.id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-emerald-500/10 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{formatTime(move.completedAt!)}</span>
                  <span className="truncate text-sm text-foreground">{move.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className="text-xs"
                    style={{
                      borderColor: move.clientColor,
                      color: move.clientColor,
                    }}
                  >
                    {move.client}
                  </Badge>
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {(move.effortEstimate || 2) * 20}m
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
