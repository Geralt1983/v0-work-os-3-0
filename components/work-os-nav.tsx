"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ListTodo, BarChart3, Users, History } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export function WorkOSNav() {
  const pathname = usePathname()
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    // Check for unread messages on mount and when pathname changes
    const checkUnread = () => {
      if (typeof window === "undefined") return
      const lastSeen = localStorage.getItem("chat-last-seen")
      const lastMessage = localStorage.getItem("chat-last-message-time")

      if (lastMessage && (!lastSeen || new Date(lastMessage) > new Date(lastSeen))) {
        setHasUnread(true)
      } else {
        setHasUnread(false)
      }
    }

    checkUnread()

    // Listen for storage changes (cross-tab)
    window.addEventListener("storage", checkUnread)
    // Listen for custom event (same tab)
    window.addEventListener("chat-message-received", checkUnread)

    return () => {
      window.removeEventListener("storage", checkUnread)
      window.removeEventListener("chat-message-received", checkUnread)
    }
  }, [pathname])

  // Clear unread when on chat page
  useEffect(() => {
    if (pathname === "/" && hasUnread) {
      localStorage.setItem("chat-last-seen", new Date().toISOString())
      setHasUnread(false)
    }
  }, [pathname, hasUnread])

  const items = [
    { href: "/tasks", icon: ListTodo, label: "Tasks" },
    { href: "/metrics", icon: BarChart3, label: "Metrics" },
    { href: "/clients", icon: Users, label: "Clients" },
    { href: "/history", icon: History, label: "History" },
  ]

  return (
    <nav className="flex items-center gap-2 p-1 rounded-2xl glass" role="navigation" aria-label="Main navigation">
      {items.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            className={cn(
              "relative h-10 w-10 flex items-center justify-center rounded-xl transition-all duration-200 btn-press focus-ring",
              "text-white/60 hover:text-white hover:bg-white/10",
              active && "text-fuchsia-300 bg-fuchsia-500/20 glow-brand",
            )}
          >
            <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} aria-hidden="true" />
            <span className="sr-only">{label}</span>
            {active && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-fuchsia-400" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
