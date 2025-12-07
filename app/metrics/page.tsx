"use client"

import {
  TargetIcon,
  BarChartIcon,
  MixIcon,
  ClockIcon,
  ArchiveIcon,
  PersonIcon,
  ChevronDownIcon,
} from "@radix-ui/react-icons"
import { useEffect } from "react"
import { WorkOSNav } from "@/components/work-os-nav"
import { PageHeader } from "@/components/page-header"

const cards = {
  pacing: {
    targetHours: 3,
    currentHours: 2.7,
    percent: 89,
    fromBacklog: 0,
    clientsTouched: 2,
  },
  weekly: {
    score: 82,
    label: "Unstoppable Flow",
    hours: [
      { day: "Mon", h: 2.8 },
      { day: "Tue", h: 3.1 },
      { day: "Wed", h: 2.8 },
      { day: "Thu", h: 2.7 },
      { day: "Fri", h: 0 },
      { day: "Sat", h: 0 },
      { day: "Sun", h: 3.8 },
    ],
    moves: 51,
    avgPerDay: 10,
  },
  momentumBreakdown: [
    { label: "Velocity", value: 40, helper: "15h per week target" },
    { label: "Consistency", value: 30, helper: "5 active days" },
    { label: "Impact", value: 30, helper: "50% deep work" },
  ],
  workTypes: [
    { label: "Deep", color: "bg-cyan-400", count: 16 },
    { label: "Comms", color: "bg-emerald-400", count: 15 },
    { label: "Creative", color: "bg-violet-400", count: 9 },
    { label: "Easy", color: "bg-amber-400", count: 8 },
    { label: "Admin", color: "bg-rose-400", count: 5 },
    { label: "Unset", color: "bg-zinc-500", count: 1 },
  ],
  rhythm: [
    { label: "6AM", value: 0 },
    { label: "7AM", value: 0 },
    { label: "8AM", value: 0 },
    { label: "9AM", value: 0 },
    { label: "10AM", value: 3 },
    { label: "11AM", value: 4 },
    { label: "12PM", value: 6 },
    { label: "1PM", value: 4 },
    { label: "2PM", value: 3 },
    { label: "3PM", value: 3 },
    { label: "4PM", value: 2 },
    { label: "5PM", value: 4 },
    { label: "6PM", value: 3 },
    { label: "7PM", value: 1 },
    { label: "8PM", value: 0 },
    { label: "9PM", value: 0 },
    { label: "10PM", value: 2 },
    { label: "11PM", value: 2 },
  ],
  backlog: [
    { client: "General Admin", status: "Empty", tone: "neutral", summary: "No backlog tasks" },
    { client: "Kentucky", status: "Empty", tone: "neutral", summary: "No backlog tasks" },
    { client: "Revenue", status: "Empty", tone: "neutral", summary: "No backlog tasks" },
    { client: "Raleigh", status: "1 aging", tone: "negative", summary: "4 tasks • avg 2d old" },
    { client: "Memphis", status: "Healthy", tone: "positive", summary: "7 tasks • avg 0d old" },
    { client: "Orlando", status: "Healthy", tone: "positive", summary: "2 tasks • avg 0d old" },
  ],
  clients: [
    {
      client: "General Admin",
      moves: 4,
      last: "3d stale",
      sentiment: "Neutral",
      priority: "Medium",
    },
    {
      client: "Memphis",
      moves: 11,
      last: "2d stale",
      sentiment: "Negative",
      priority: "High",
    },
    {
      client: "Kentucky",
      moves: 10,
      last: "1d ago",
      sentiment: "Neutral",
      priority: "Medium",
    },
    {
      client: "Orlando",
      moves: 5,
      last: "1d ago",
      sentiment: "Positive",
      priority: "Low",
    },
    {
      client: "Revenue",
      moves: 3,
      last: "1d ago",
      sentiment: "Positive",
      priority: "High",
    },
    {
      client: "Raleigh",
      moves: 20,
      last: "Active",
      sentiment: "Negative",
      priority: "High",
    },
  ],
}

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

function sentimentClasses(sentiment: string) {
  switch (sentiment) {
    case "Positive":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    case "Negative":
      return "border-rose-500/40 bg-rose-500/10 text-rose-300"
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-100"
  }
}

function priorityClasses(priority: string) {
  switch (priority) {
    case "High":
      return "border-rose-500/40 bg-rose-500/10 text-rose-300"
    case "Low":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-100"
  }
}

export default function MetricsDashboard() {
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
    const resizeObserverLoopErr = resizeObserverLoopErrRe.test.bind(resizeObserverLoopErrRe)
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

  const pacingPercent = cards.pacing.percent
  const pacingWidth = `${pacingPercent}%`
  const maxWeekly = 5
  const maxRhythm = Math.max(...cards.rhythm.map((r) => r.value), 1)
  const totalWorkType = cards.workTypes.reduce((sum, w) => sum + w.count, 0)

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
          {/* Top row */}
          <section className="grid gap-6 md:grid-cols-2">
            {/* Today pacing */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">
                    <TargetIcon className="h-4 w-4 text-cyan-400" />
                  </div>
                  <h2 className="text-lg font-semibold">Today's Pacing</h2>
                </div>
                <span className="text-emerald-400 text-xl font-semibold">
                  {cards.pacing.percent}
                  <span className="text-base align-middle">%</span>
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-300">
                {cards.pacing.currentHours}h of {cards.pacing.targetHours}h target
              </p>
              <div className="mt-3 h-2 rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                  style={{ width: pacingWidth }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                <span>{cards.pacing.fromBacklog} from backlog</span>
                <span>{cards.pacing.clientsTouched} clients touched</span>
              </div>
            </div>

            {/* Weekly trends */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">
                    <BarChartIcon className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Weekly Trends</h2>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Momentum score</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold text-cyan-400">{cards.weekly.score}</div>
                  <div className="text-xs font-medium text-emerald-400">{cards.weekly.label}</div>
                </div>
              </div>
              <div className="mt-5 h-52 rounded-2xl bg-zinc-900/60 px-3 pb-5 pt-4">
                <div className="flex h-full items-end gap-2">
                  {cards.weekly.hours.map((h) => {
                    const barHeight = h.h > 0 ? Math.max((h.h / maxWeekly) * 180, 14) : 6
                    return (
                      <div key={h.day} className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="flex w-full flex-col items-center gap-1" style={{ height: "180px" }}>
                          {h.h > 0 && <span className="text-[10px] font-medium text-cyan-400">{h.h}h</span>}
                          <div className="flex w-full flex-1 items-end justify-center">
                            <div
                              className="w-full rounded-t-lg bg-cyan-500 transition-all"
                              style={{ height: `${barHeight}px` }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500">{h.day}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  <span className="text-zinc-100">{cards.weekly.moves}</span> moves
                </span>
                <span>
                  <span className="text-zinc-100">{cards.weekly.avgPerDay}</span> avg/day
                </span>
                <span className="text-emerald-400">Weekly target hit!</span>
              </div>
            </div>
          </section>

          {/* Work type breakdown */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">
                <MixIcon className="h-4 w-4 text-cyan-400" />
              </div>
              <h2 className="text-lg font-semibold">Work Type Breakdown</h2>
            </div>
            <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-zinc-800 shadow-inner">
              <div className="flex h-full w-full">
                {cards.workTypes.map((t) => (
                  <div
                    key={t.label}
                    className={`${t.color}`}
                    style={{ width: `${(t.count / totalWorkType) * 100}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {cards.workTypes.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <span className={`h-3 w-3 rounded-full ${t.color} shadow-lg flex-shrink-0`} />
                  <div className="flex flex-col items-start">
                    <span className="text-xl font-semibold text-zinc-100">{t.count}</span>
                    <span className="text-xs text-zinc-500">{t.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Productivity rhythm */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">
                <ClockIcon className="h-4 w-4 text-cyan-400" />
              </div>
              <h2 className="text-lg font-semibold">Productivity Rhythm</h2>
            </div>
            <div className="mt-4 h-48 rounded-2xl bg-zinc-900/60 px-3 pb-5 pt-3">
              <div className="flex h-full items-end gap-1.5">
                {cards.rhythm
                  .filter((_, idx) => idx % 2 === 0)
                  .map((slot) => {
                    const barHeight = slot.value > 0 ? Math.max((slot.value / maxRhythm) * 160, 24) : 0
                    const numericLabel = slot.label.replace(/[AP]M/, "")
                    return (
                      <div key={slot.label} className="flex flex-1 flex-col items-center justify-end gap-1">
                        <div className="flex w-full items-end justify-center" style={{ height: "160px" }}>
                          {slot.value > 0 && (
                            <div
                              className="w-full rounded-t-lg bg-emerald-500 transition-all"
                              style={{ height: `${barHeight}px` }}
                            />
                          )}
                        </div>
                        <span className="text-[9px] text-zinc-600">{numericLabel}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </section>

          {/* Backlog and clients */}
          <section className="grid gap-6 lg:grid-cols-2">
            {/* Backlog health */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-zinc-700/40">
                  <ArchiveIcon className="h-4 w-4 text-zinc-300" />
                </div>
                <h2 className="text-lg font-semibold">Backlog Health</h2>
              </div>
              <div className="mt-4 space-y-3">
                {cards.backlog.map((item) => (
                  <div
                    key={item.client}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-zinc-50">{item.client}</div>
                      <div className="text-xs text-zinc-500">{item.summary}</div>
                    </div>
                    <span
                      className={
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium " +
                        statusToneClasses(item.tone as "positive" | "neutral" | "negative")
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Client activity */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-md shadow-black/40">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-zinc-700/40">
                  <PersonIcon className="h-4 w-4 text-zinc-300" />
                </div>
                <h2 className="text-lg font-semibold">Client Activity</h2>
              </div>
              <div className="mt-4 space-y-3">
                {cards.clients.map((client) => (
                  <div key={client.client} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-zinc-50">{client.client}</div>
                        <div className="text-xs text-zinc-500">{client.moves} moves</div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium border ${
                          client.last === "Active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : client.last.includes("3d stale")
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : client.last.includes("2d stale")
                                ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                                : "bg-zinc-700/50 text-zinc-300 border-zinc-600/40"
                        }`}
                      >
                        {client.last}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Sentiment</span>
                        <button
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${sentimentClasses(client.sentiment)}`}
                        >
                          {client.sentiment}
                          <ChevronDownIcon className="h-3 w-3 opacity-60" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Priority</span>
                        <button
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${priorityClasses(client.priority)}`}
                        >
                          {client.priority}
                          <ChevronDownIcon className="h-3 w-3 opacity-60" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
