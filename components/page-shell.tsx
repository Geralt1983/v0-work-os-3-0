import type { ReactNode } from "react"
import { WorkOSNav } from "@/components/work-os-nav"

interface PageShellProps {
  /** Page title displayed in the header */
  title: string
  /** Optional subtitle/description */
  description?: string
  /** Optional actions (buttons, etc.) to render next to the nav */
  actions?: ReactNode
  /** Main content */
  children: ReactNode
  /** Use wider max-width (for dashboard/tasks page) */
  wide?: boolean
  /** Show ThanosOS brand indicator */
  showBrand?: boolean
}

export function PageShell({
  title,
  description,
  actions,
  children,
  wide = false,
  showBrand = false,
}: PageShellProps) {
  return (
    <div className="min-h-screen text-zinc-50">
      <div className={`mx-auto px-4 py-6 md:py-8 ${wide ? "max-w-7xl" : "max-w-6xl"}`}>
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            {showBrand && (
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[color:var(--thanos-gold)]/80 mb-2">
                <span className="h-2 w-2 rounded-full bg-[color:var(--thanos-gold)] shadow-[0_0_12px_rgba(234,179,8,0.6)]" />
                ThanosOS
              </div>
            )}
            <h1 className="text-xl font-display text-zinc-100 sm:text-2xl md:text-3xl tracking-[0.12em]">
              {title}
            </h1>
            {description && (
              <p className="hidden sm:block text-sm text-white/60">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {actions}
            <WorkOSNav />
          </div>
        </div>

        {/* Main content */}
        <main className="mt-8 flex flex-col gap-6 pb-20">
          {children}
        </main>
      </div>
    </div>
  )
}
