"use client"

import { useState, useEffect } from "react"
import { useBacklogRecommendations } from "@/hooks/use-backlog-recommendations"
import { useTasks } from "@/hooks/use-tasks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ArrowUp, Zap, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Clock, Check } from "lucide-react"
import useSWR, { mutate as globalMutate } from "swr"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface AvoidanceData {
  staleClients: Array<{ name: string; daysSinceTouch: number }>
  frequentlyDeferred: Array<{ moveId: number; title: string; clientName: string; deferCount: number }>
}

export function SynapsePicks() {
  const { recommendations, isLoading, error, refresh } = useBacklogRecommendations()
  const { updateTaskStatus, refresh: refreshTasks } = useTasks()
  const shouldReduceMotion = useReducedMotion()
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
  const topPick = recommendations[0]
  const remainingCount = recommendations.length > 1 ? recommendations.length - 1 : 0
  const isPromotingTop = topPick ? promotingIds.has(topPick.id) : false
  const wasPromotedTop = topPick ? promotedIds.has(topPick.id) : false

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
        className="mb-6 w-full flex items-center justify-between gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 transition"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[color:var(--thanos-amethyst)]" />
          <span className="text-sm font-medium text-foreground">Show ThanosAI Spotlight</span>
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
    <Card className="mb-6 panel-obsidian rounded-xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-[color:var(--thanos-amethyst)]/7">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50">
              <span className="h-2 w-2 rounded-full bg-[color:var(--thanos-amethyst)]/80 shadow-[0_0_12px_rgba(168,85,247,0.3)]" />
              ThanosAI Spotlight
            </div>
            <CardTitle className="mt-2 flex items-center gap-2 text-lg text-foreground">
              <Sparkles className="h-5 w-5 text-[color:var(--thanos-amethyst)]" />
              Single Pick
            </CardTitle>
            <p className="text-sm text-muted-foreground">One high-confidence task to move now.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-8 w-8 p-0">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleToggleCollapse} className="h-8 w-8 p-0">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
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

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              <div className="h-4 w-3/4 rounded bg-zinc-800/60 shimmer" />
              <div className="h-3 w-1/2 rounded bg-zinc-800/50 shimmer" />
              <div className="h-14 rounded-lg bg-zinc-800/40 shimmer" />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="py-4 text-center text-muted-foreground"
            >
              <p>Could not load recommendations</p>
              <Button variant="link" size="sm" onClick={handleRefresh}>
                Try again
              </Button>
            </motion.div>
          ) : !topPick ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="py-4 text-center text-muted-foreground"
            >
              <p>No recommendations right now</p>
              <p className="text-xs mt-1">Add items to your backlog to get AI suggestions</p>
            </motion.div>
          ) : (
            <motion.div
              key={topPick.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-start justify-between gap-4 p-4 rounded-lg border border-white/10 bg-zinc-900/50 ${wasPromotedTop ? "opacity-60" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground leading-snug">{topPick.title}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: topPick.clientColor,
                      color: topPick.clientColor,
                    }}
                  >
                    {topPick.clientName}
                  </Badge>
                  {topPick.drainType && (
                    <Badge variant="secondary" className="text-xs">
                      {topPick.drainType}
                    </Badge>
                  )}
                  {topPick.effortEstimate === 1 && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-green-900/50 text-green-400 border-green-500/30"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Quick
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{topPick.reason}</p>
              </div>
              <Button
                size="sm"
                className={`shrink-0 rounded-lg ${
                  wasPromotedTop
                    ? "bg-green-950/50 border border-green-500/50 text-green-400"
                    : "bg-[color:var(--thanos-amethyst)] text-white hover:bg-[color:var(--thanos-amethyst)]/90 shadow-[0_0_16px_rgba(168,85,247,0.25)]"
                }`}
                onClick={() => handlePromote(topPick.id)}
                disabled={isPromotingTop || wasPromotedTop}
              >
                {isPromotingTop ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : wasPromotedTop ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowUp className="h-4 w-4 mr-1" />
                )}
                {wasPromotedTop ? "Promoted" : "Promote"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {remainingCount > 0 && (
          <p className="text-[10px] text-muted-foreground/60 mt-4 text-center">
            {remainingCount} more in the AI queue
          </p>
        )}
      </CardContent>
    </Card>
  )
}
