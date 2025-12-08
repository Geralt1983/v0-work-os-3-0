"use client"

import { TargetIcon, BarChartIcon, PersonIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { useEffect } from "react"
import { WorkOSNav } from "@/components/work-os-nav"
import { PageHeader } from "@/components/page-header"
import { useMetrics } from "@/hooks/use-metrics"

function statusToneClasses(tone: "positive" | "neutral" | "negative") {
  switch (tone) {
    case "positive":
      return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    case "negative":
      return "border border-rose-500/30 bg-rose-500/10 text-rose-300"
    default:
      return "border border-zinc-600/40 bg-zinc-800/40 text-zinc-100"
  }
}

function getDaysSinceLabel(days: number | null): { label: string; tone: "positive" | "neutral" | "negative" } {
  if (days === null) return { label: "No activity", tone: "neutral" }
  if (days === 0) return { label: "Active today", tone: "positive" }
  if (days === 1) return { label: "1d ago", tone: "positive" }
  if (days <= 2) return { label: `${days}d ago`, tone: "neutral" }
  return { label: `${days}d stale`, tone: "negative" }
}

export default function MetricsDashboard() {
  const { today, clients, isLoading, error } = useMetrics()

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      if (event.message && event.message.includes("ResizeObserver loop")) {
        event.stopImmediatePropagation()
        return false
      }
    }

    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes("ResizeObserver loop")) {
        event.preventDefault()
      }
    }

    const resizeObserverLoopErrRe = /^[^(ResizeObserver loop limit exceeded)]/
    const originalError = window.console.error
    window.console.error = (...args) => {
      if (args[0]?.toString().includes("ResizeObserver loop")) {
        return
      }
      originalError.apply(window.console, args)
    }

    window.addEventListener("error", errorHandler)
    window.addEventListener("unhandledrejection", unhandledRejectionHandler)

    return () => {
      window.removeEventListener("error", errorHandler)
      window.removeEventListener("unhandledrejection", unhandledRejectionHandler)
      window.console.error = originalError
    }
  }, [])

  const earnedMinutes = today?.earnedMinutes || 0
  const targetMinutes = today?.targetMinutes || 180
  const pacingPercent = Math.min(Math.round((earnedMinutes / targetMinutes) * 100), 100)
  const pacingWidth = `${pacingPercent}%`
  const completedCount = today?.completedCount || 0
  const paceStatus = today?.paceStatus || "behind"

  const staleClients = clients.filter((c) => c.isStale)
  const activeClients = clients.filter((c) => c.activeMoves > 0)

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="Metrics" description="See your pacing, momentum, and weekly flow." />
          <div className="flex-shrink-0 pt-4">
            <WorkOSNav />
          </div>
        </div>

        <main className="mt-8 flex flex-col gap-8 pb-20">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">
              Failed to load metrics. Please try again.
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Top row - Today's Progress */}
              <section className="grid gap-6 md:grid-cols-2">
                {/* Today pacing - REAL DATA */}
                <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">
                        <TargetIcon className="h-4 w-4 text-cyan-400" />
                      </div>
                      <h2 className="text-lg font-semibold">Today's Pacing</h2>
                    </div>
                    <span
                      className={`text-xl font-semibold ${paceStatus === "on_track" ? "text-emerald-400" : "text-amber-400"}`}
                    >
                      {pacingPercent}
                      <span className="text-base align-middle">%</span>
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    {earnedMinutes} min of {targetMinutes} min target
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        paceStatus === "on_track"
                          ? "bg-gradient-to-r from-cyan-500 to-emerald-500"
                          : "bg-gradient-to-r from-amber-500 to-orange-500"
                      }`}
                      style={{ width: pacingWidth }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      <span className="text-zinc-100">{completedCount}</span> moves completed
                    </span>
                    <span>
                      <span className="text-zinc-100">{activeClients.length}</span> clients active
                    </span>
                  </div>
                </div>

                {/* Daily Summary */}
                <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">
                        <BarChartIcon className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">Daily Summary</h2>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Real-time stats</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-semibold text-cyan-400">{completedCount}</div>
                      <div className="text-xs font-medium text-zinc-400">moves today</div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                      <div className="text-2xl font-semibold text-zinc-100">{earnedMinutes}</div>
                      <div className="text-xs text-zinc-500">min earned</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                      <div className="text-2xl font-semibold text-zinc-100">{targetMinutes - earnedMinutes}</div>
                      <div className="text-xs text-zinc-500">min remaining</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                      <div className="text-2xl font-semibold text-zinc-100">{clients.length}</div>
                      <div className="text-xs text-zinc-500">total clients</div>
                    </div>
                  </div>
                  {paceStatus === "on_track" ? (
                    <p className="mt-4 text-center text-sm text-emerald-400">Target reached! Great work today.</p>
                  ) : (
                    <p className="mt-4 text-center text-sm text-amber-400">
                      {Math.ceil((targetMinutes - earnedMinutes) / 20)} more moves to hit target
                    </p>
                  )}
                </div>
              </section>

              {/* Stale clients warning */}
              {staleClients.length > 0 && (
                <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-md shadow-black/40">
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
                    <h2 className="text-lg font-semibold text-amber-300">
                      {staleClients.length} Stale Client{staleClients.length > 1 ? "s" : ""}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-amber-200/70">These clients haven't had activity in over 2 days:</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {staleClients.map((client) => (
                      <span
                        key={client.clientId}
                        className="rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-sm text-amber-200"
                      >
                        {client.clientName} ({client.daysSinceLastMove}d)
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Client Activity - REAL DATA */}
              <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-zinc-700/40">
                    <PersonIcon className="h-4 w-4 text-zinc-300" />
                  </div>
                  <h2 className="text-lg font-semibold">Client Activity</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {clients.length === 0 ? (
                    <p className="text-sm text-zinc-500">No client data available.</p>
                  ) : (
                    clients.map((client) => {
                      const { label, tone } = getDaysSinceLabel(client.daysSinceLastMove)
                      return (
                        <div
                          key={client.clientId}
                          className={`rounded-2xl border bg-zinc-900/70 px-4 py-3 ${
                            client.isStale ? "border-amber-500/30" : "border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-3">
                              {client.isStale && (
                                <ExclamationTriangleIcon className="h-4 w-4 text-amber-400 flex-shrink-0" />
                              )}
                              <div>
                                <div className="font-medium text-zinc-50">{client.clientName}</div>
                                <div className="text-xs text-zinc-500">
                                  {client.totalMoves} total moves · {client.completedMoves} completed
                                </div>
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium border ${statusToneClasses(tone)}`}
                            >
                              {label}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-500">Active:</span>
                              <span className="text-zinc-100">{client.activeMoves}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-500">Completed:</span>
                              <span className="text-zinc-100">{client.completedMoves}</span>
                            </div>
                            {client.daysSinceLastMove !== null && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-500">Last move:</span>
                                <span className={client.isStale ? "text-amber-400" : "text-zinc-100"}>
                                  {client.daysSinceLastMove === 0 ? "today" : `${client.daysSinceLastMove}d ago`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
