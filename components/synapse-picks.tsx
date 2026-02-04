"use client"

import { useState, useEffect } from "react"
import { useBacklogRecommendations } from "@/hooks/use-backlog-recommendations"
import { useTasks } from "@/hooks/use-tasks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ArrowUp, Zap, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Clock, Check } from "lucide-react"
import useSWR, { mutate as globalMutate } from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface AvoidanceData {
  staleClients: Array<{ name: string; daysSinceTouch: number }>
  frequentlyDeferred: Array<{ moveId: number; title: string; clientName: string; deferCount: number }>
}

export function SynapsePicks() {
  const { recommendations, isLoading, error, refresh } = useBacklogRecommendations()
  const { updateTaskStatus, refresh: refreshTasks } = useTasks()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [promotingIds, setPromotingIds] = useState<Set<number>>(new Set())
  const [promotedIds, setPromotedIds] = useState<Set<number>>(new Set())

  const { data: avoidanceData } = useSWR<AvoidanceData>("/api/avoidance", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  })

  const hasStaleClients = avoidanceData?.staleClients && avoidanceData.staleClients.length > 0
  const hasDeferredTasks = avoidanceData?.frequentlyDeferred && avoidanceData.frequentlyDeferred.length > 0
  const hasAvoidanceIssues = hasStaleClients || hasDeferredTasks

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
    setPromotingIds((prev) => new Set(prev).add(moveId))

    try {
      await updateTaskStatus(moveId.toString(), "upnext")

      // Mark as promoted for success feedback
      setPromotedIds((prev) => new Set(prev).add(moveId))

      // Refresh moves list, recommendations, and grouped backlog
      await Promise.all([refreshTasks(), refresh(), globalMutate("/api/backlog/grouped")])

      // Clear promoted state after delay
      setTimeout(() => {
        setPromotedIds((prev) => {
          const next = new Set(prev)
          next.delete(moveId)
          return next
        })
      }, 2000)
    } catch (err) {
      console.error("[v0] SynapsePicks: Failed to promote move", err)
    } finally {
      setPromotingIds((prev) => {
        const next = new Set(prev)
        next.delete(moveId)
        return next
      })
    }
  }

  if (isCollapsed) {
    return (
      <button
        onClick={handleToggleCollapse}
        className="mb-6 w-full flex items-center justify-between gap-2 px-4 py-2 rounded-lg border border-[color:var(--thanos-amethyst)]/30 bg-gradient-to-r from-[color:var(--thanos-amethyst)]/10 to-[color:var(--thanos-gold)]/10 hover:from-[color:var(--thanos-amethyst)]/20 hover:to-[color:var(--thanos-gold)]/20 transition"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[color:var(--thanos-amethyst)]" />
          <span className="text-sm font-medium text-foreground">Show ThanosAI Picks</span>
          {recommendations.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-[color:var(--thanos-amethyst)]/20 text-[color:var(--thanos-amethyst)]">
              {recommendations.length}
            </Badge>
          )}
          {hasAvoidanceIssues && (
            <Badge variant="secondary" className="text-xs bg-amber-900/50 text-amber-400 border-amber-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Attention
            </Badge>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    )
  }

  return (
    <Card className="mb-6 panel-obsidian gold-edge bg-gradient-to-r from-[color:var(--thanos-amethyst)]/15 to-[color:var(--thanos-gold)]/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Sparkles className="h-5 w-5 text-[color:var(--thanos-amethyst)]" />
            ThanosAI Picks
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
        {hasStaleClients && (
          <div className="mb-4 p-3 rounded-lg bg-amber-900/30 border border-amber-700/50">
            <div className="flex items-start gap-2 text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">{avoidanceData!.staleClients.map((c) => c.name).join(", ")}</span>{" "}
                {avoidanceData!.staleClients.length === 1 ? "hasn't" : "haven't"} been touched in{" "}
                {Math.max(...avoidanceData!.staleClients.map((c) => c.daysSinceTouch))}+ days
              </div>
            </div>
          </div>
        )}

        {hasDeferredTasks && (
          <div className="mb-4 p-3 rounded-lg bg-orange-900/30 border border-orange-700/50">
            <div className="flex items-start gap-2 text-orange-400 text-sm">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">"{avoidanceData!.frequentlyDeferred[0].title}"</span> has been deferred{" "}
                {avoidanceData!.frequentlyDeferred[0].deferCount}x - do it, break it down, or delete it
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="animate-pulse flex items-center gap-2 py-4">
            <span className="text-[color:var(--thanos-amethyst)]">Analyzing backlog...</span>
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
            {recommendations.map((rec) => {
              const isPromoting = promotingIds.has(rec.id)
              const wasPromoted = promotedIds.has(rec.id)

              return (
                <div
                  key={rec.id}
                  className={`flex items-start justify-between gap-4 p-3 bg-card/50 rounded-lg border border-border/50 shadow-sm transition-opacity ${wasPromoted ? "opacity-50" : ""}`}
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
                        <Badge
                          variant="secondary"
                          className="text-xs bg-green-900/50 text-green-400 border-green-500/30"
                        >
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
                    className={`shrink-0 transition-colors ${
                      wasPromoted
                        ? "bg-green-950/50 border-green-500/50 text-green-400"
                        : "hover:bg-[color:var(--thanos-amethyst)]/10 hover:border-[color:var(--thanos-amethyst)]/50 bg-transparent"
                    }`}
                    onClick={() => handlePromote(rec.id)}
                    disabled={isPromoting || wasPromoted}
                  >
                    {isPromoting ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : wasPromoted ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <ArrowUp className="h-4 w-4 mr-1" />
                    )}
                    {wasPromoted ? "Promoted" : "Promote"}
                  </Button>
                </div>
              )
            })}
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
