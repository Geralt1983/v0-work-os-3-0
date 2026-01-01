"use client"

import useSWR, { mutate as globalMutate } from "swr"
import { MOCK_CLIENTS, MOCK_TASKS, isPreviewEnvironment } from "@/lib/mock-data"
import { trackCompletedTask } from "@/hooks/use-metrics"
import { apiFetch, SWR_CONFIG } from "@/lib/fetch-utils"
import {
  type BackendTaskStatus,
  type FrontendTaskStatus,
  type TaskSizeType,
  type ValueTier,
  STATUS_TO_FRONTEND,
  STATUS_TO_BACKEND,
  effortToSize,
  pointsToSize,
  sizeToEffort,
  getValueTierPoints,
} from "@/lib/domain"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// Re-export domain types with legacy alias for backward compatibility
export type { BackendTaskStatus }
export type TaskStatus = FrontendTaskStatus

interface BackendTask {
  id: number
  clientId: number | null
  title: string
  description: string | null
  status: BackendTaskStatus
  valueTier: string | null
  effortEstimate: number | null
  effortActual: number | null
  drainType: string | null
  sortOrder: number | null
  subtasks?: Subtask[] | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  clientName?: string
  client?: { id: number; name: string; color: string | null }
  pointsAiGuess?: number | null
  pointsFinal?: number | null
  pointsAdjustedAt?: string | null
}

export interface Task {
  id: string
  client: string
  clientId?: number
  clientColor?: string
  title: string
  description?: string
  type: TaskSizeType
  valueTier?: ValueTier
  effortEstimate?: number
  status: FrontendTaskStatus
  subtasks?: Subtask[]
  tasksCount?: number
  ageLabel?: string
  completedAt?: number
  sortOrder?: number
  drainType?: string
  points?: number // Final points from value tier
  pointsAiGuess?: number
  pointsFinal?: number
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

function getAgeLabel(createdAt: string): string {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "today"
  if (diffDays === 1) return "1d ago"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

// =============================================================================
// MOCK MODE HELPERS
// =============================================================================
function shouldUseMockMode(): boolean {
  return isPreviewEnvironment()
}

function mergeWithMockData<T extends { id: number }>(realData: T[] | null | undefined, mockData: T[]): T[] {
  const isPreview = isPreviewEnvironment()
  const hasRealData = Array.isArray(realData) && realData.length > 0

  if (!isPreview) return realData || []
  if (hasRealData) return realData

  return mockData
}

// =============================================================================
// LOCAL STATE FOR PREVIEW MODE
// =============================================================================
let localTasks: Task[] = []

function getLocalTasks(): Task[] {
  return localTasks
}

function addLocalTask(task: Task) {
  localTasks = [task, ...localTasks]
}

function updateLocalTask(id: string, updates: Partial<Task>) {
  localTasks = localTasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
}

function removeLocalTask(id: string) {
  localTasks = localTasks.filter((t) => t.id !== id)
}

// =============================================================================
// TASKS HOOK
// =============================================================================
const TASKS_KEY = "tasks"

export function useTasks() {
  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    TASKS_KEY,
    async () => {
      let backendTasks: BackendTask[] = []
      try {
        backendTasks = await apiFetch<BackendTask[]>("/api/tasks")
      } catch (err) {
        console.log("[v0] useTasks: API error, will use mock data if in preview", err)
      }

      const tasksToUse = mergeWithMockData(backendTasks, MOCK_TASKS as BackendTask[])

      const mappedTasks = tasksToUse.map((task) => {
        // Calculate points from valueTier (preferred) or fall back to legacy fields
        const valueTier = task.valueTier as ValueTier | undefined
        const points = valueTier
          ? getValueTierPoints(valueTier)
          : (task.pointsFinal ?? task.pointsAiGuess ?? task.effortEstimate ?? 2)

        return {
          id: task.id.toString(),
          client: task.clientName ?? (task.client ? task.client.name : ""),
          clientId: task.clientId ?? undefined,
          clientColor: task.client?.color ?? undefined,
          title: task.title,
          description: task.description ?? undefined,
          type: pointsToSize(points),
          valueTier,
          effortEstimate: task.effortEstimate ?? 2,
          status: STATUS_TO_FRONTEND[task.status],
          subtasks: (task.subtasks as Subtask[]) ?? [],
          tasksCount: undefined,
          ageLabel: getAgeLabel(task.createdAt),
          completedAt: task.completedAt ? new Date(task.completedAt).getTime() : undefined,
          sortOrder: task.sortOrder ?? undefined,
          drainType: task.drainType ?? undefined,
          points,
          pointsAiGuess: task.pointsAiGuess ?? undefined,
          pointsFinal: task.pointsFinal ?? undefined,
        }
      })

      if (isPreviewEnvironment()) {
        const localTasksData = getLocalTasks()
        const apiTaskIds = new Set(mappedTasks.map((t) => t.id))
        const uniqueLocalTasks = localTasksData.filter((t) => !apiTaskIds.has(t.id))
        return [...uniqueLocalTasks, ...mappedTasks]
      }

      return mappedTasks
    },
    SWR_CONFIG.default,
  )

  const tasks = data ?? []

  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  // =============================================================================
  // MUTATIONS
  // =============================================================================
  const completeTask = async (id: string) => {
    const taskToComplete = tasks.find((t) => t.id === id)
    const effortEstimate = taskToComplete ? sizeToEffort(taskToComplete.type) : 2

    if (shouldUseMockMode()) {
      updateLocalTask(id, { status: "done" as TaskStatus, completedAt: Date.now() })
      trackCompletedTask({ id: Number.parseInt(id, 10), effortEstimate })
    }

    mutate(
      (current: Task[] | undefined) =>
        current?.map((t) => (t.id === id ? { ...t, status: "done" as TaskStatus, completedAt: Date.now() } : t)),
      false,
    )

    try {
      const response = await apiFetch<{ hitGoalToday?: boolean; currentStreak?: number }>(`/api/tasks/${id}/complete`, { method: "POST" })

      console.log("[v0] completeTask: Task completed, triggering milestone check")
      try {
        const milestoneRes = await fetch("/api/notifications/milestone", { method: "POST" })
        const milestoneData = await milestoneRes.json()
        console.log("[v0] completeTask: Milestone check result", milestoneData)
      } catch (notifyErr) {
        console.log("[v0] completeTask: Milestone notification check failed:", notifyErr)
      }

      globalMutate("/api/metrics/today")
      globalMutate("/api/metrics/clients")
      globalMutate("/api/streaks")
      mutate()

      return response
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] completeTask: API failed in preview, using local state")
      globalMutate("/api/metrics/today")
      globalMutate("/api/metrics/clients")
    }
  }

  const restoreTask = async (id: string, previousStatus: TaskStatus = "today") => {
    if (shouldUseMockMode()) {
      updateLocalTask(id, { status: previousStatus, completedAt: undefined })
    }

    mutate(
      (current: Task[] | undefined) =>
        current?.map((t) => (t.id === id ? { ...t, status: previousStatus, completedAt: undefined } : t)),
      false,
    )

    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: STATUS_TO_BACKEND[previousStatus], completedAt: null }),
      })
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] restoreTask: API failed in preview, using local state")
    }
  }

  const updateTaskStatus = async (id: string, newStatus: TaskStatus, insertAtIndex?: number) => {
    if (shouldUseMockMode()) {
      updateLocalTask(id, { status: newStatus })
    }

    let newSortOrder: number | undefined
    if (insertAtIndex !== undefined) {
      const targetTasks = tasks
        .filter((t) => t.status === newStatus)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      if (targetTasks.length === 0) {
        newSortOrder = 0
      } else if (insertAtIndex === 0) {
        newSortOrder = (targetTasks[0]?.sortOrder ?? 0) - 1
      } else if (insertAtIndex >= targetTasks.length) {
        newSortOrder = (targetTasks[targetTasks.length - 1]?.sortOrder ?? 0) + 1
      } else {
        const before = targetTasks[insertAtIndex - 1]?.sortOrder ?? 0
        const after = targetTasks[insertAtIndex]?.sortOrder ?? 0
        newSortOrder = (before + after) / 2
      }
    }

    mutate((current: Task[] | undefined) => {
      if (!current) return current
      const taskToUpdate = current.find((t) => t.id === id)
      if (!taskToUpdate) return current

      const withoutTask = current.filter((t) => t.id !== id)
      const updatedTask = { ...taskToUpdate, status: newStatus, sortOrder: newSortOrder }

      return [...withoutTask, updatedTask]
    }, false)

    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: STATUS_TO_BACKEND[newStatus],
          sortOrder: newSortOrder,
        }),
      })
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] updateTaskStatus: API failed in preview, using local state")
    }
  }

  const reorderTasks = async (status: TaskStatus, orderedIds: string[]) => {
    mutate((current: Task[] | undefined) => {
      if (!current) return current
      const statusTasks = current.filter((t) => t.status === status)
      const otherTasks = current.filter((t) => t.status !== status)

      const reordered: Task[] = orderedIds
        .map((id, index) => {
          const task = statusTasks.find((t) => t.id === id)
          if (task) {
            return { ...task, sortOrder: index } as Task
          }
          return null
        })
        .filter((t): t is Task => t !== null)

      return [...otherTasks, ...reordered]
    }, false)

    try {
      await apiFetch(`/api/tasks/reorder`, {
        method: "POST",
        body: JSON.stringify({
          status: STATUS_TO_BACKEND[status],
          orderedIds: orderedIds.map((id) => Number.parseInt(id, 10)),
        }),
      })
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] reorderTasks: API failed in preview, using local state")
    }
  }

  const createTask = async (taskData: {
    title: string
    clientId?: number
    clientName?: string
    description?: string
    status?: TaskStatus
    valueTier?: ValueTier
    drainType?: string
    pointsAiGuess?: number
    pointsFinal?: number
  }) => {
    const backendStatus = taskData.status ? STATUS_TO_BACKEND[taskData.status] : "backlog"
    const targetStatus = taskData.status || "backlog"
    const valueTier = taskData.valueTier || "progress"
    const points = getValueTierPoints(valueTier)

    const optimisticId = `temp-${Date.now()}`
    const optimisticTask: Task = {
      id: optimisticId,
      client: taskData.clientName || "",
      clientId: taskData.clientId,
      clientColor: undefined,
      title: taskData.title,
      description: taskData.description,
      type: pointsToSize(points),
      valueTier,
      status: targetStatus,
      ageLabel: "today",
      sortOrder: -1,
      points,
      pointsAiGuess: taskData.pointsAiGuess,
      pointsFinal: taskData.pointsFinal,
    }

    mutate(
      (current: Task[] | undefined) => {
        return current ? [optimisticTask, ...current] : [optimisticTask]
      },
      false,
    )

    try {
      const response = await apiFetch<BackendTask>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: taskData.title,
          clientId: taskData.clientId || null,
          description: taskData.description || null,
          status: backendStatus,
          valueTier,
          drainType: taskData.drainType || null,
          sortOrder: -1,
        }),
      })

      mutate(
        (current: Task[] | undefined) => {
          if (!current) return current
          return current.map((t) =>
            t.id === optimisticId
              ? {
                  ...t,
                  id: response.id.toString(),
                  client: response.clientName || taskData.clientName || "",
                  clientColor: response.client?.color ?? undefined,
                }
              : t,
          )
        },
        false,
      )

      return response
    } catch (err) {
      if (shouldUseMockMode()) {
        const localTaskId = `local-${Date.now()}`
        addLocalTask({ ...optimisticTask, id: localTaskId })

        mutate((current: Task[] | undefined) => {
          if (!current) return current
          return current.map((t) => (t.id === optimisticId ? { ...t, id: localTaskId } : t))
        }, false)

        return { id: Number(localTaskId) } as BackendTask
      }

      mutate((current: Task[] | undefined) => {
        if (!current) return current
        return current.filter((t) => t.id !== optimisticId)
      }, false)
      throw err
    }
  }

  const updateTask = async (
    id: string,
    taskData: {
      title?: string
      clientId?: number
      description?: string
      status?: TaskStatus
      valueTier?: ValueTier
      drainType?: string
    },
  ) => {
    const backendStatus = taskData.status ? STATUS_TO_BACKEND[taskData.status] : undefined
    const points = taskData.valueTier ? getValueTierPoints(taskData.valueTier) : undefined

    mutate((current: Task[] | undefined) => {
      if (!current) return current
      return current.map((t) => {
        if (t.id !== id) return t
        return {
          ...t,
          title: taskData.title ?? t.title,
          clientId: taskData.clientId ?? t.clientId,
          description: taskData.description ?? t.description,
          status: taskData.status ?? t.status,
          valueTier: taskData.valueTier ?? t.valueTier,
          type: points ? pointsToSize(points) : t.type,
          points: points ?? t.points,
        }
      })
    }, false)

    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: taskData.title,
          clientId: taskData.clientId,
          description: taskData.description,
          status: backendStatus,
          valueTier: taskData.valueTier,
          drainType: taskData.drainType,
        }),
      })
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] updateTask: API failed in preview, using local state")
    }
  }

  const updateSubtasks = async (id: string, subtasks: Subtask[]) => {
    mutate((current: Task[] | undefined) => {
      if (!current) return current
      return current.map((t) => (t.id === id ? { ...t, subtasks } : t))
    }, false)

    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ subtasks }),
      })
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] updateSubtasks: API failed in preview, using local state")
    }
  }

  const setSubtasksFromTitles = async (id: string, titles: string[]) => {
    const subtasks: Subtask[] = titles.map((title) => ({
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      completed: false,
    }))
    await updateSubtasks(id, subtasks)
  }

  const promoteTask = async (id: string) => {
    return updateTaskStatus(id, "upnext")
  }

  const deleteTask = async (id: string) => {
    mutate((current: Task[] | undefined) => {
      if (!current) return current
      return current.filter((t) => t.id !== id)
    }, false)

    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE" })
      globalMutate("/api/backlog/grouped")
      globalMutate("/api/backlog/recommendations")
    } catch (err) {
      if (!shouldUseMockMode()) {
        mutate()
        throw err
      }
      console.log("[v0] deleteTask: API failed in preview, using local state")
      removeLocalTask(id)
    }
  }

  return {
    tasks,
    loading: isLoading,
    isLoading,
    error,
    todayTasks: byStatus("today"),
    upNextTasks: byStatus("upnext"),
    backlogTasks: byStatus("backlog"),
    doneTasks: byStatus("done"),
    completeTask,
    restoreTask,
    updateTaskStatus,
    reorderTasks,
    createTask,
    updateTask,
    updateSubtasks,
    setSubtasksFromTitles,
    promoteTask,
    deleteTask,
    refresh: () => mutate(),
  }
}

// =============================================================================
// CLIENTS HOOK
// =============================================================================
interface BackendClient {
  id: number
  name: string
  type: string
  color: string | null
  isActive: number
  createdAt: string
}

export interface Client {
  id: number
  name: string
  color?: string
  isActive: boolean
}

export function useClients() {
  const { data, error, isLoading } = useSWR<Client[]>(
    "clients",
    async () => {
      let backendClients: BackendClient[] = []
      try {
        backendClients = await apiFetch<BackendClient[]>("/api/clients")
      } catch (err) {
        console.log("[v0] useClients: API error, will use mock data if in preview", err)
      }

      const clientsToUse = mergeWithMockData(backendClients, MOCK_CLIENTS as BackendClient[])

      const mapped = clientsToUse
        .filter((c) => c.isActive === 1)
        .map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color ?? undefined,
          isActive: c.isActive === 1,
        }))

      return mapped
    },
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnMount: true,
    },
  )

  return {
    clients: data ?? [],
    isLoading,
    error,
  }
}
