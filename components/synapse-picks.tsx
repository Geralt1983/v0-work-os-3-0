"use client"

import { useState, useEffect } from "react"
import { useBacklogRecommendations } from "@/hooks/use-backlog-recommendations"
import { useMoves } from "@/hooks/use-moves"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ArrowUp, Zap, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"

export function SynapsePicks() {
  const { recommendations, isLoading, error, refresh } = useBacklogRecommendations()
  const { updateMoveStatus, refresh: refreshMoves } = useMoves()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("synapse-picks-collapsed")
    if (stored === "true") {
      setIsCollapsed(true)
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    const startTime = Date.now()
    await refresh()
    // Ensure spinner shows for at least 500ms
    const elapsed = Date.now() - startTime
    if (elapsed < 500) {
      await new Promise((resolve) => setTimeout(resolve, 500 - elapsed))
    }
    setIsRefreshing(false)
  }

  const handleToggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("synapse-picks-collapsed", String(newState))
  }

  const handlePromote = async (moveId: number) => {
    await updateMoveStatus(moveId.toString(), "upnext")
    refresh()
    refreshMoves()
  }

  if (isCollapsed) {
    return (
      <button
        onClick={handleToggleCollapse}
        className="mb-6 w-full flex items-center justify-between gap-2 px-4 py-2 rounded-lg border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-950/20 to-purple-950/20 hover:from-fuchsia-950/30 hover:to-purple-950/30 transition"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-fuchsia-500" />
          <span className="text-sm font-medium text-foreground">Show Synapse Picks</span>
          {recommendations.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-fuchsia-900/50 text-fuchsia-300">
              {recommendations.length}
            </Badge>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    )
  }

  return (
    <Card className="mb-6 border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-950/30 to-purple-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Sparkles className="h-5 w-5 text-fuchsia-500" />
            Synapse Picks
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-8 w-8 p-0">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleToggleCollapse} className="h-8 w-8 p-0">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">AI-suggested tasks based on client health and your patterns</p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="animate-pulse flex items-center gap-2 py-4">
            <span className="text-fuchsia-300">Analyzing backlog...</span>
          </div>
        )}

        {error && (
          <div className="py-4 text-center text-muted-foreground">
            <p>Could not load recommendations</p>
            <Button variant="link" size="sm" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !error && recommendations.length === 0 && (
          <div className="py-4 text-center text-muted-foreground">
            <p>No recommendations right now</p>
            <p className="text-xs mt-1">Add items to your backlog to get AI suggestions</p>
          </div>
        )}

        {!isLoading && recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="flex items-start justify-between gap-4 p-3 bg-card/50 rounded-lg border border-border/50 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground leading-snug">{rec.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: rec.clientColor,
                        color: rec.clientColor,
                      }}
                    >
                      {rec.clientName}
                    </Badge>
                    {rec.drainType && (
                      <Badge variant="secondary" className="text-xs">
                        {rec.drainType}
                      </Badge>
                    )}
                    {rec.effortEstimate === 1 && (
                      <Badge variant="secondary" className="text-xs bg-green-900/50 text-green-400 border-green-500/30">
                        <Zap className="h-3 w-3 mr-1" />
                        Quick
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{rec.reason}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 hover:bg-fuchsia-950/50 hover:border-fuchsia-500/50 bg-transparent"
                  onClick={() => handlePromote(rec.id)}
                >
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Promote
                </Button>
              </div>
            ))}
          </div>
        )}

        {!isLoading && recommendations.length > 0 && (
          <p className="text-[10px] text-muted-foreground/60 mt-4 text-center">
            Scored by: client staleness, backlog age, energy-time match, quick-win potential
          </p>
        )}
      </CardContent>
    </Card>
  )
}
