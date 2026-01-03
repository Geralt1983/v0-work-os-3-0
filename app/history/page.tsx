"use client"

import { CompletionHeatmap } from "@/components/completion-heatmap"
import { CompletionTimeline } from "@/components/completion-timeline"
import { WorkOSNav } from "@/components/work-os-nav"

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl md:text-3xl">History</h1>
            <p className="hidden sm:block text-sm text-white/60 mt-1">Track your progress and patterns over time.</p>
          </div>
          <WorkOSNav />
        </div>

        <main className="mt-8 flex flex-col gap-8 pb-20">
          <CompletionHeatmap />
          <CompletionTimeline />
        </main>
      </div>
    </div>
  )
}
