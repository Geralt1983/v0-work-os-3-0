"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, ListTodo, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

export function WorkOSNav() {
  const pathname = usePathname()

  const items = [
    { href: "/", icon: MessageSquare },
    { href: "/moves", icon: ListTodo },
    { href: "/metrics", icon: BarChart3 },
  ]

  return (
    <div className="flex items-center gap-4">
      {items.map(({ href, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 bg-black/40 text-white/70 transition",
              "hover:text-white hover:border-white/30",
              active && "text-fuchsia-300 border-fuchsia-500/60 bg-fuchsia-500/10",
            )}
          >
            <Icon className="h-5 w-5" />
          </Link>
        )
      })}
    </div>
  )
}
