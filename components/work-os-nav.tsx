"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ListTodo, BarChart3, Users, History, Palmtree, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCallback } from "react"
import { preload } from "swr"
import { swrFetcher } from "@/lib/fetch-utils"
import { WORKOS_COMMAND_PALETTE_OPEN_EVENT } from "@/components/work-os-command-palette"

const ROUTE_PREFETCH_KEYS: Record<string, string[]> = {
  "/tasks": ["/api/tasks", "/api/clients", "/api/backlog/grouped", "/api/backlog/recommendations"],
  "/metrics": ["/api/metrics/today", "/api/metrics/clients"],
  "/clients": ["/api/clients"],
  "/history": ["/api/moves/heatmap", "/api/moves/history"],
}

export function WorkOSNav() {
  const pathname = usePathname()
  const router = useRouter()

  const prefetchRoute = useCallback(
    (href: string) => {
      const keys = ROUTE_PREFETCH_KEYS[href]
      if (keys) {
        keys.forEach((key) => {
          preload(key, swrFetcher)
        })
      }
      // Also prefetch the page itself
      router.prefetch(href)
    },
    [router],
  )

  const items = [
    { href: "/tasks", icon: ListTodo, label: "Tasks" },
    { href: "/metrics", icon: BarChart3, label: "Metrics" },
    { href: "/clients", icon: Users, label: "Clients" },
    { href: "/history", icon: History, label: "History" },
    { href: "/holidays", icon: Palmtree, label: "Holidays" },
  ]

  return (
    <nav
      className="flex items-center gap-1 sm:gap-2 p-0.5 sm:p-1 rounded-2xl glass max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="navigation"
      aria-label="Main navigation"
    >
      <button
        type="button"
        aria-label="Command palette"
        title="Command palette (Ctrl+K / Cmd+K)"
        onClick={() => window.dispatchEvent(new Event(WORKOS_COMMAND_PALETTE_OPEN_EVENT))}
        className={cn(
          "relative h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl transition-all duration-200 btn-press focus-ring",
          "text-white/60 hover:text-white hover:bg-white/10",
        )}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Command palette</span>
      </button>

      {items.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            prefetch={true}
            onMouseEnter={() => prefetchRoute(href)}
            onFocus={() => prefetchRoute(href)}
            className={cn(
              "relative h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl transition-all duration-200 btn-press focus-ring",
              "text-white/60 hover:text-white hover:bg-white/10",
              active && "text-zinc-100 bg-white/10 ring-1 ring-white/15",
            )}
          >
            <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} aria-hidden="true" />
            <span className="sr-only">{label}</span>
            {active && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[color:var(--thanos-amethyst)]" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
