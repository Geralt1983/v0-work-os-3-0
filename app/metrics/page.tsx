"use client"

import { TargetIcon, BarChartIcon, PersonIcon, ExclamationTriangleIcon, LightningBoltIcon } from "@radix-ui/react-icons"
import { useEffect, useState } from "react"
import { WorkOSNav } from "@/components/work-os-nav"
import { PageHeader } from "@/components/page-header"
import { useMetrics } from "@/hooks/use-metrics"
import { Button } from "@/components/ui/button"

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

function getMomentumStatusColor(status: string): string {
  switch (status) {
    case "crushing":
      return "text-emerald-400"
    case "on_track":
      return "text-cyan-400"
    case "behind":
      return "text-amber-400"
    case "stalled":
      return "text-rose-400"
    default:
      return "text-zinc-400"
  }
}

function getMomentumGradient(status: string): string {
  switch (status) {
    case "crushing":
      return "bg-gradient-to-r from-emerald-500 to-cyan-500"
    case "on_track":
      return "bg-gradient-to-r from-cyan-500 to-blue-500"
    case "behind":
      return "bg-gradient-to-r from-amber-500 to-yellow-500"
    case "stalled":
      return "bg-gradient-to-r from-rose-500 to-orange-500"
    default:
      return "bg-zinc-600"
  }
}

function getMomentumAdvice(status: string): string {
  switch (status) {
    case "crushing":
      return "Ahead of schedule! Keep the momentum going."
    case "on_track":
      return "Right on pace. Steady wins the race."
    case "behind":
      return "Falling behind. Focus on quick wins to catch up."
    case "stalled":
      return "Momentum stalled. Start with the easiest task."
    default:
      return ""
  }
}

function getMomentumStatusLabel(status: string): string {
  switch (status) {
    case "crushing":
      return "Crushing it"
    case "on_track":
      return "On track"
    case "behind":
      return "Behind pace"
    case "stalled":
      return "Stalled"
    default:
      return ""
  }
}

function getMomentumStatusEmoji(status: string): string {
  switch (status) {
    case "crushing":
      return "🔥"
    case "on_track":
      return "✅"
    case "behind":
      return "⚠️"
    case "stalled":
      return "🚨"
    default:
      return ""
  }
}

function getMomentumScoreColor(score: number): string {
  if (score >= 100) return "text-amber-400" // gold for crushing
  if (score >= 70) return "text-emerald-400" // green for on track
  if (score >= 40) return "text-amber-500" // orange for behind
  return "text-rose-400" // red for stalled
}

export default function MetricsDashboard() {
  const { today, clients, isLoading, error } = useMetrics()
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null)

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
  const fullPercent = today?.percent || pacingPercent
  const pacingWidth = `${pacingPercent}%`
  const completedCount = today?.completedCount || 0
  const paceStatus = today?.paceStatus || "behind"

  const momentum = today?.momentum || {
    score: 0,
    percent: 0,
    status: "stalled" as const,
    label: "Stalled",
    expectedByNow: 0,
    actualMinutes: 0,
    dayProgress: 0,
  }

  const staleClients = clients.filter((c) => c.isStale)
  const activeClients = clients.filter((c) => c.activeMoves > 0)

  const sendTestNotification = async () => {
    setNotificationStatus("Sending test...")
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Test notification from Work-OS Metrics page" }),
      })
      const data = await res.json()
      setNotificationStatus(data.success ? "Test sent!" : `Failed: ${data.error}`)
    } catch (err) {
      setNotificationStatus(`Error: ${err}`)
    }
    setTimeout(() => setNotificationStatus(null), 3000)
  }

  const sendMorningSummary = async () => {
    setNotificationStatus("Sending morning summary...")
    try {
      const res = await fetch("/api/notifications/morning-summary")
      const data = await res.json()
      setNotificationStatus(data.success ? "Morning summary sent!" : `Failed: ${data.error}`)
    } catch (err) {
      setNotificationStatus(`Error: ${err}`)
    }
    setTimeout(() => setNotificationStatus(null), 3000)
  }

  const sendAfternoonSummary = async () => {
    setNotificationStatus("Sending afternoon summary...")
    try {
      const res = await fetch("/api/notifications/afternoon-summary")
      const data = await res.json()
      setNotificationStatus(data.success ? "Afternoon summary sent!" : `Failed: ${data.error}`)
    } catch (err) {
      setNotificationStatus(`Error: ${err}`)
    }
    setTimeout(() => setNotificationStatus(null), 3000)
  }

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="Metrics" description="See your pacing, momentum, and weekly flow." />
          <div className="flex-shrink-0 pt-1">
            <WorkOSNav />
          </div>
        </div>

        <main className="mt-8 flex flex-col gap-8 pb-20">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">
              Failed to load metrics. Please try again.
            </div>
          )}

          {!isLoading && !error && (
            <>
              <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">
                        <TargetIcon className="h-4 w-4 text-cyan-400" />
                      </div>
                      <h2 className="text-lg font-semibold">Today's Progress</h2>
                    </div>
                    <span
                      className={`text-xl font-semibold ${paceStatus === "on_track" ? "text-emerald-400" : "text-amber-400"}`}
                    >
                      {fullPercent}
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

                <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40 flex flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-500/15">
                        <LightningBoltIcon className="h-4 w-4 text-violet-400" />
                      </div>
                      <h2 className="text-lg font-semibold">Momentum</h2>
                    </div>
                    <span className={`text-4xl font-bold tabular-nums ${getMomentumScoreColor(momentum.score)}`}>
                      {momentum.score}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center py-6">
                    <span className={`text-2xl ${getMomentumStatusColor(momentum.status)}`}>
                      {getMomentumStatusEmoji(momentum.status)} {getMomentumStatusLabel(momentum.status)}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-400 text-center italic">"{getMomentumAdvice(momentum.status)}"</p>
                </div>

                <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40 md:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">
                        <BarChartIcon className="h-4 w-4 text-cyan-400" />
                      </div>
                      <h2 className="text-lg font-semibold">Daily Summary</h2>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
                      <div className="text-3xl font-semibold text-cyan-400">{completedCount}</div>
                      <div className="text-xs text-zinc-500 mt-1">moves today</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
                      <div className="text-3xl font-semibold text-zinc-100">{clients.length}</div>
                      <div className="text-xs text-zinc-500 mt-1">total clients</div>
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

              {staleClients.length > 0 && (
                <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-md shadow-black/40">
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
                    <h2 className="text-lg font-semibold text-amber-300">
                      {staleClients.length} Stale Client{staleClients.length !== 1 ? "s" : ""}
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

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-500/15">
                    <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold">Notification Testing</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" onClick={sendTestNotification}>
                    Send Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={sendMorningSummary}>
                    Morning Summary
                  </Button>
                  <Button variant="outline" size="sm" onClick={sendAfternoonSummary}>
                    Afternoon Summary
                  </Button>
                </div>
                {notificationStatus && (
                  <p
                    className={`mt-3 text-sm ${notificationStatus.includes("Failed") || notificationStatus.includes("Error") ? "text-rose-400" : "text-emerald-400"}`}
                  >
                    {notificationStatus}
                  </p>
                )}
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-500/15">
                    <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold">Behavioral AI Testing</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setNotificationStatus("Fetching avoidance report...")
                      try {
                        const res = await fetch("/api/avoidance")
                        const data = await res.json()
                        console.log("[v0] Avoidance Report:", data)
                        setNotificationStatus(
                          `Report: ${data.staleClients?.length || 0} stale, ${data.deferredTasks?.length || 0} deferred, ${data.recommendations?.length || 0} recommendations. Check console for full data.`,
                        )
                      } catch (err) {
                        setNotificationStatus(`Error: ${err}`)
                      }
                      setTimeout(() => setNotificationStatus(null), 5000)
                    }}
                  >
                    Get Avoidance Report
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setNotificationStatus("Running daily snapshot...")
                      try {
                        const res = await fetch("/api/cron/snapshot")
                        const data = await res.json()
                        console.log("[v0] Snapshot Result:", data)
                        setNotificationStatus(
                          data.success
                            ? `Snapshot saved: ${data.snapshot?.moves_completed || 0} moves, ${data.snapshot?.minutes_earned || 0} min`
                            : `Failed: ${data.error}`,
                        )
                      } catch (err) {
                        setNotificationStatus(`Error: ${err}`)
                      }
                      setTimeout(() => setNotificationStatus(null), 5000)
                    }}
                  >
                    Run Daily Snapshot
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setNotificationStatus("Fetching event log...")
                      try {
                        const res = await fetch("/api/test/simulate-deferral")
                        const data = await res.json()
                        console.log("[v0] Event Log:", data.events)
                        const summary = data.events
                          ?.slice(0, 5)
                          .map((e: any) => `${e.eventType}: ${e.moveTitle || "Unknown"}`)
                          .join(", ")
                        setNotificationStatus(
                          `${data.events?.length || 0} events logged. Recent: ${summary || "None"}. Check console.`,
                        )
                      } catch (err) {
                        setNotificationStatus(`Error: ${err}`)
                      }
                      setTimeout(() => setNotificationStatus(null), 8000)
                    }}
                  >
                    View Event Log
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const moveId = prompt("Enter Move ID to simulate deferral:")
                      if (!moveId) return
                      setNotificationStatus("Simulating deferral...")
                      try {
                        const res = await fetch("/api/test/simulate-deferral", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ moveId: Number.parseInt(moveId) }),
                        })
                        const data = await res.json()
                        console.log("[v0] Deferral Simulation:", data)
                        setNotificationStatus(data.message || data.error)
                      } catch (err) {
                        setNotificationStatus(`Error: ${err}`)
                      }
                      setTimeout(() => setNotificationStatus(null), 5000)
                    }}
                  >
                    Simulate Deferral
                  </Button>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Test by: 1) Drag tasks backward (Active → Backlog) to log demotions. 2) Use "Simulate Deferral" with a
                  move ID. 3) Check "View Event Log" to see all tracked events.
                </p>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
