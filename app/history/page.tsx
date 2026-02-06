"use client"

import { CompletionHeatmap } from "@/components/completion-heatmap"
import { CompletionTimeline } from "@/components/completion-timeline"
import { WorkOSNav } from "@/components/work-os-nav"
import { PageHeader } from "@/components/page-header"

export default function HistoryPage() {
  return (
    <div className="min-h-screen text-zinc-50 noise-overlay">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="History" description="Track your progress and patterns over time." />
          <WorkOSNav />
        </div>

        <main className="mt-8 flex flex-col gap-8 pb-20 animate-comic-pop">
          <CompletionHeatmap />
          <CompletionTimeline />
        </main>
      </div>
    </div>
  )
}
