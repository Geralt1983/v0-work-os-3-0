"use client"

import { useState } from "react"
import { useMoveHistory } from "@/hooks/use-task-history"
import { useClients } from "@/hooks/use-tasks"
import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Calendar, Filter, SlidersHorizontal } from "lucide-react"

export function CompletionTimeline() {
  const isMobile = useIsMobile()
  const [days, setDays] = useState(30)
  const [clientFilter, setClientFilter] = useState<string>("all")

  const { clients } = useClients()
  const { timeline, isLoading } = useMoveHistory(
    days,
    clientFilter !== "all" ? Number.parseInt(clientFilter) : undefined,
  )

  // Count active filters for badge
  const activeFilterCount = (clientFilter !== "all" ? 1 : 0) + (days !== 30 ? 1 : 0)

  const formatDate = (dateStr: string, displayLabel: string | null) => {
    if (displayLabel) return displayLabel

    const date = new Date(dateStr + "T12:00:00") // Add noon time to avoid timezone edge cases
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr)
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase()
  }

  const FilterControls = ({ className }: { className?: string }) => (
    <div className={className}>
      <Select value={clientFilter} onValueChange={setClientFilter}>
        <SelectTrigger className="w-full">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue placeholder="All clients" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All clients</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id.toString()}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={days.toString()} onValueChange={(v) => setDays(Number.parseInt(v))}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="14">Last 14 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  const MobileMoveCard = ({ move }: { move: (typeof timeline)[0]["moves"][0] }) => (
    <div className="bg-muted/20 rounded-lg p-3 space-y-2">
      <p className="text-sm font-medium">{move.title}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge
          variant="outline"
          className="text-xs"
          style={{
            borderColor: move.clientColor,
            color: move.clientColor,
          }}
        >
          {move.clientName}
        </Badge>
        {move.drainType && (
          <Badge variant="secondary" className="text-xs">
            {move.drainType}
          </Badge>
        )}
        <span className="text-muted-foreground">{(move.effortEstimate || 1) * 20}m</span>
        <span className="text-muted-foreground ml-auto">{formatTime(move.completedAt)}</span>
      </div>
    </div>
  )

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Completion History
          </CardTitle>

          {isMobile ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative bg-transparent">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto">
                <SheetHeader>
                  <SheetTitle>Filter History</SheetTitle>
                </SheetHeader>
                <FilterControls className="space-y-3 mt-4 pb-4" />
              </SheetContent>
            </Sheet>
          ) : (
            /* Desktop: Inline filters */
            <div className="flex items-center gap-2">
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={days.toString()} onValueChange={(v) => setDays(Number.parseInt(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading history...</div>
        ) : timeline.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No completed moves in this period.</div>
        ) : (
          <div className="space-y-6">
            {timeline.map((day) => (
              <div key={day.date}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">{formatDate(day.date, day.displayLabel)}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{day.moves.length} moves</span>
                    <span>&bull;</span>
                    <span>{day.totalMinutes} min</span>
                    <span>&bull;</span>
                    <span>{day.clientsTouched.length} clients</span>
                  </div>
                </div>

                {isMobile ? (
                  <div className="space-y-2">
                    {day.moves.map((move) => (
                      <MobileMoveCard key={move.id} move={move} />
                    ))}
                  </div>
                ) : (
                  <div className="border-l-2 border-border pl-4 space-y-2">
                    {day.moves.map((move) => (
                      <div key={move.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">
                            {formatTime(move.completedAt)}
                          </span>
                          <span className="truncate text-sm">{move.title}</span>
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
                            {move.clientName}
                          </Badge>
                          {move.drainType && (
                            <Badge variant="secondary" className="text-xs">
                              {move.drainType}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{(move.effortEstimate || 1) * 20}m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
