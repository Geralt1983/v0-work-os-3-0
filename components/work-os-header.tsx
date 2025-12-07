"use client"

import { WorkOSNav } from "@/components/work-os-nav"

interface WorkOSHeaderProps {
  title?: string
  subtitle?: string
}

export function WorkOSHeader({ title = "Work OS", subtitle = "One move per client, every day." }: WorkOSHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="hidden sm:block text-sm text-white/60 md:text-base">{subtitle}</p>
      </div>

      <div className="flex items-center justify-start md:justify-end">
        <WorkOSNav />
      </div>
    </header>
  )
}
