"use client"

import { CompletionHeatmap } from "@/components/completion-heatmap"
import { CompletionTimeline } from "@/components/completion-timeline"
import { PageShell } from "@/components/page-shell"

export default function HistoryPage() {
  return (
    <PageShell
      title="History"
      description="Track your progress and patterns over time."
    >
      <CompletionHeatmap />
      <CompletionTimeline />
    </PageShell>
  )
}
