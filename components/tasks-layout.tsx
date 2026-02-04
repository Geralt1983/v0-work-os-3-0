"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { SWRConfig } from "swr"

import { useIsMobile } from "@/hooks/use-mobile"
import { SynapseSidebar } from "@/components/synapse-sidebar"
import { SynapseMobileSheet } from "@/components/synapse-mobile-sheet"
import useSWR from "swr"

interface TasksLayoutProps {
  children: React.ReactNode
}

export function TasksLayout({ children }: TasksLayoutProps) {
  const isMobile = useIsMobile()
  const [isCollapsed, setIsCollapsed] = useState(true) // Default collapsed until loaded

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("synapse-sidebar-collapsed")
    setIsCollapsed(stored === "true")
  }, [])

  // Listen for changes to collapsed state
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem("synapse-sidebar-collapsed")
      setIsCollapsed(stored === "true")
    }

    // Custom event for same-tab updates
    window.addEventListener("synapse-collapse-change", handleStorageChange)
    // Storage event for cross-tab updates
    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("synapse-collapse-change", handleStorageChange)
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  // Fetch avoidance warning for sidebar
  const { data: avoidanceData } = useSWR(
    "/api/avoidance",
    async (url) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        return res.json()
      } catch {
        return null
      }
    },
    { revalidateOnFocus: false, refreshInterval: 60000 },
  )

  // Generate warning message from avoidance data
  const avoidanceWarning =
    avoidanceData?.staleClients?.length > 0
      ? `${avoidanceData.staleClients.length} client${avoidanceData.staleClients.length > 1 ? "s" : ""} need attention`
      : null

  return (
    <SWRConfig
      value={{
        keepPreviousData: true,
        revalidateOnFocus: true,
        revalidateIfStale: true,
        dedupingInterval: 5000,
      }}
    >
      <div className="min-h-screen thanos-shell">
        <div
          className={
            isMobile
              ? "relative z-10"
              : isCollapsed
                ? "relative z-10"
                : "mr-[380px] transition-[margin] duration-300 relative z-10"
          }
        >
          {children}
        </div>

        {/* Synapse chat - sidebar on desktop, floating sheet on mobile */}
        {isMobile ? <SynapseMobileSheet /> : <SynapseSidebar avoidanceWarning={avoidanceWarning} />}
      </div>
    </SWRConfig>
  )
}
