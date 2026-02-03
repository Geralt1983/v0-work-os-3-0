/**
 * Custom hook for task filtering and view state management.
 * Extracts filter logic from tasks/page.tsx to improve maintainability.
 */

import { useState, useMemo, useCallback } from "react"
import type { Task } from "@/hooks/use-tasks"

export type TasksView = "board" | "list" | "focus"
export type TaskStatus = "today" | "upnext" | "backlog" | "done"
export type DrainType = "deep" | "shallow" | "admin"

export interface FilterOptions {
  clientFilter: string
  statusFilter: string
  typeFilter: string
}

export interface FilterOption {
  value: string
  label: string
}

export interface UseTaskFiltersReturn {
  // View state
  view: TasksView
  setView: (view: TasksView) => void

  // Filter state
  clientFilter: string
  setClientFilter: (filter: string) => void
  statusFilter: string
  setStatusFilter: (filter: string) => void
  typeFilter: string
  setTypeFilter: (filter: string) => void

  // Computed options
  clientOptions: string[]
  statusOptions: FilterOption[]
  typeOptions: FilterOption[]

  // Filter helpers
  filteredTasks: Task[]
  resetFilters: () => void
  hasActiveFilters: boolean
}

const STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "today", label: "Today" },
  { value: "upnext", label: "Queued" },
]

const TYPE_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Types" },
  { value: "deep", label: "Deep" },
  { value: "shallow", label: "Shallow" },
  { value: "admin", label: "Admin" },
]

/**
 * Hook for managing task filtering and view state.
 *
 * @param tasks - Array of tasks to filter
 * @returns Filter state, setters, and computed values
 *
 * @example
 * ```tsx
 * const {
 *   view,
 *   setView,
 *   clientFilter,
 *   setClientFilter,
 *   filteredTasks,
 *   resetFilters,
 * } = useTaskFilters(tasks)
 * ```
 */
export function useTaskFilters(tasks: Task[]): UseTaskFiltersReturn {
  // View state
  const [view, setView] = useState<TasksView>("board")

  // Filter state
  const [clientFilter, setClientFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  // Compute client options from tasks
  const clientOptions = useMemo(() => {
    const names = new Set(tasks.map((t) => t.client).filter(Boolean))
    return Array.from(names).sort() as string[]
  }, [tasks])

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Client filter
      if (clientFilter !== "all" && task.client !== clientFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false
      }

      // Type/drain filter
      if (typeFilter !== "all" && task.drainType !== typeFilter) {
        return false
      }

      return true
    })
  }, [tasks, clientFilter, statusFilter, typeFilter])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setClientFilter("all")
    setStatusFilter("all")
    setTypeFilter("all")
  }, [])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return clientFilter !== "all" || statusFilter !== "all" || typeFilter !== "all"
  }, [clientFilter, statusFilter, typeFilter])

  return {
    // View state
    view,
    setView,

    // Filter state
    clientFilter,
    setClientFilter,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,

    // Computed options
    clientOptions,
    statusOptions: STATUS_OPTIONS,
    typeOptions: TYPE_OPTIONS,

    // Filter helpers
    filteredTasks,
    resetFilters,
    hasActiveFilters,
  }
}

export default useTaskFilters
