"use client"

import { useState } from "react"
import { useGroupedBacklog } from "@/hooks/use-grouped-backlog"
import { useMoves } from "@/hooks/use-moves"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, ArrowUp, Clock, AlertTriangle } from "lucide-react"

function getDecayBadge(status: "normal" | "aging" | "stale" | "critical") {
  switch (status) {
    case "aging":
      return (
        <Badge variant="secondary" className="text-[10px] bg-amber-900/50 text-amber-400">
          aging
        </Badge>
      )
    case "stale":
      return (
        <Badge variant="secondary" className="text-[10px] bg-orange-900/50 text-orange-400">
          stale
        </Badge>
      )
    case "critical":
      return (
        <Badge variant="secondary" className="text-[10px] bg-red-900/50 text-red-400">
          critical
        </Badge>
      )
    default:
      return null
  }
}

export function GroupedBacklog() {
  const { groups, totalTasks, isLoading, refresh } = useGroupedBacklog()
  const { updateMoveStatus, refresh: refreshMoves } = useMoves()
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set())

  const toggleClient = (clientId: number) => {
    setExpandedClients((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const handlePromote = async (taskId: number) => {
    await updateMoveStatus(taskId.toString(), "upnext")
    refresh()
    refreshMoves()
  }

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-zinc-800/50 rounded-lg" />
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No tasks in backlog</p>
        <p className="text-xs mt-1">Add tasks to see them grouped by client</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>
          {totalTasks} tasks across {groups.length} clients
        </span>
      </div>

      {groups.map((group) => {
        const isExpanded = expandedClients.has(group.clientId)
        const hasStaleClient = group.staleDays >= 3

        return (
          <div key={group.clientId} className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleClient(group.clientId)}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/30 transition"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Badge variant="outline" style={{ borderColor: group.clientColor, color: group.clientColor }}>
                  {group.clientName}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {group.tasks.length} task{group.tasks.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasStaleClient && (
                  <Badge variant="secondary" className="text-[10px] bg-orange-900/50 text-orange-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {group.staleDays}d stale
                  </Badge>
                )}
                {group.touchedToday && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-900/50 text-emerald-400">
                    active
                  </Badge>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border/30 bg-zinc-900/30">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-3 py-2 border-b border-border/20 last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground leading-snug">{task.title}</span>
                        {getDecayBadge(task.decayStatus)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {task.drainType && <span className="text-[10px] text-muted-foreground">{task.drainType}</span>}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.daysInBacklog}d
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePromote(task.id)
                      }}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
