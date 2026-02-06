"use client"

import { HolidayManager } from "@/components/holiday-manager"
import { WorkOSNav } from "@/components/work-os-nav"
import { PageHeader } from "@/components/page-header"

export default function HolidaysPage() {
  return (
    <div className="min-h-screen text-zinc-50 noise-overlay">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="Holidays" description="Manage holidays and time off." />
          <WorkOSNav />
        </div>

        <div className="mt-8">
          <HolidayManager />
        </div>
      </div>
    </div>
  )
}
