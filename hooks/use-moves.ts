"use client"

import useSWR, { mutate as globalMutate } from "swr"
import { MOCK_CLIENTS, MOCK_MOVES, isPreviewEnvironment } from "@/lib/mock-data"
import { trackCompletedMove } from "@/hooks/use-metrics"

// =============================================================================
// API CONFIGURATION - Removed debug logs, using local API routes
// =============================================================================
const API_BASE_URL = ""

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
export type BackendMoveStatus = "active" | "queued" | "backlog" | "done"
export type MoveStatus = "today" | "upnext" | "backlog" | "done"

interface BackendMove {
  id: number
  clientId: number | null
  title: string
  description: string | null
  status: BackendMoveStatus
  effortEstimate: number | null
  effortActual: number | null
  drainType: string | null
  sortOrder: number | null
  subtasks?: Subtask[] | null // Add subtasks
  createdAt: string
  updatedAt: string
  completedAt: string | null
  clientName?: string
  client?: { id: number; name: string; color: string | null }
  complexityAiGuess?: number | null
  complexityFinal?: number | null
  complexityAdjustedAt?: string | null
}

export interface Move {
  id: string
  client: string
  clientId?: number
  clientColor?: string // Add clientColor for display
  title: string
  description?: string
  type: "Quick" | "Standard" | "Chunky" | "Deep"
  effortEstimate?: number // Preserve effortEstimate for calculations
  status: MoveStatus
  subtasks?: Subtask[] // Add subtasks
  movesCount?: number
  ageLabel?: string
  completedAt?: number
  sortOrder?: number
  drainType?: string
  complexity?: number // Final complexity (user-adjusted or AI guess)
  complexityAiGuess?: number
  complexityFinal?: number
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

// =============================================================================
// STATUS MAPPING
// =============================================================================
const statusToFrontend: Record<BackendMoveStatus, MoveStatus> = {
  active: "today",
  queued: "upnext",
  backlog: "backlog",
  done: "done",
}

const statusToBackend: Record<MoveStatus, BackendMoveStatus> = {
  today: "active",
  upnext: "queued",
  backlog: "backlog",
  done: "done",
}

function effortToType(effort: number | null): Move["type"] {
  switch (effort) {
    case 1:
      return "Quick"
    case 2:
      return "Standard"
    case 3:
      return "Chunky"
    case 4:
      return "Deep"
    default:
      return "Standard"
  }
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
// API FETCHER
// =============================================================================
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.text().catch(() => "Unknown error")
    throw new Error(`API error ${res.status}: ${error}`)
  }

  return res.json()
}

function shouldUseMockMode(): boolean {
  return isPreviewEnvironment()
}

const mockIdCounter = 1000

function mergeWithMockData<T extends { id: number }>(realData: T[] | null | undefined, mockData: T[]): T[] {
  const isPreview = isPreviewEnvironment()
  const hasRealData = Array.isArray(realData) && realData.length > 0

  console.log("[v0] mergeWithMockData:", { isPreview, realDataLength: realData?.length, hasRealData })

  if (!isPreview) return realData || []
  if (hasRealData) return realData

  console.log("[v0] Using mock data in preview environment")
  return mockData
}

// =============================================================================
// =============================================================================
let localMoves: Move[] = []
const localMovesInitialized = false

function getLocalMoves(): Move[] {
  return localMoves
}

function addLocalMove(move: Move) {
  // Add to beginning (top of column)
  localMoves = [move, ...localMoves]
}

function updateLocalMove(id: string, updates: Partial<Move>) {
  localMoves = localMoves.map((m) => (m.id === id ? { ...m, ...updates } : m))
}

function removeLocalMove(id: string) {
  localMoves = localMoves.filter((m) => m.id !== id)
}

// =============================================================================
// MOVES HOOK
// =============================================================================
const MOVES_KEY = "moves"

export function useMoves() {
  const { data, error, isLoading, mutate } = useSWR<Move[]>(
    MOVES_KEY,
    async () => {
      let backendMoves: BackendMove[] = []
      try {
        backendMoves = await apiFetch<BackendMove[]>("/api/moves")
      } catch (err) {
        console.log("[v0] useMoves: API error, will use mock data if in preview", err)
      }

      const movesToUse = mergeWithMockData(backendMoves, MOCK_MOVES as any)

      const mappedMoves = movesToUse.map((move) => ({
        id: move.id.toString(),
        client: move.clientName ?? (move.client ? move.client.name : ""),
        clientId: move.clientId ?? undefined,
        clientColor: move.client?.color ?? undefined, // Include client color
        title: move.title,
        description: move.description ?? undefined,
        type: effortToType(move.effortEstimate),
        effortEstimate: move.effortEstimate ?? 2, // Preserve effort estimate
        status: statusToFrontend[move.status],
        subtasks: (move.subtasks as Subtask[]) ?? [],
        movesCount: undefined,
        ageLabel: getAgeLabel(move.createdAt),
        completedAt: move.completedAt ? new Date(move.completedAt).getTime() : undefined,
        sortOrder: move.sortOrder ?? undefined,
        drainType: move.drainType ?? undefined,
        complexity: move.complexityFinal ?? move.complexityAiGuess ?? undefined,
        complexityAiGuess: move.complexityAiGuess ?? undefined,
        complexityFinal: move.complexityFinal ?? undefined,
      }))

      if (isPreviewEnvironment()) {
        const localMovesData = getLocalMoves()
        const apiMoveIds = new Set(mappedMoves.map((m) => m.id))
        const uniqueLocalMoves = localMovesData.filter((m) => !apiMoveIds.has(m.id))
        return [...uniqueLocalMoves, ...mappedMoves]
      }

      return mappedMoves
    },
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
    },
  )

  const moves = data ?? []

  const byStatus = (status: MoveStatus) => moves.filter((m) => m.status === status)

  // =============================================================================
  // MUTATIONS
  // =============================================================================
  const completeMove = async (id: string) => {
    const moveToComplete = moves.find((m) => m.id === id)
    const effortEstimate =
      moveToComplete?.type === "Quick"
        ? 1
        : moveToComplete?.type === "Standard"
          ? 2
          : moveToComplete?.type === "Chunky"
            ? 3
            : moveToComplete?.type === "Deep"
              ? 4
              : 2

    if (shouldUseMockMode()) {
      updateLocalMove(id, { status: "done" as MoveStatus, completedAt: Date.now() })
      trackCompletedMove({ id: Number.parseInt(id), effortEstimate })
    }

    mutate(
      (current: Move[] | undefined) =>
        current?.map((m) => (m.id === id ? { ...m, status: "done" as MoveStatus, completedAt: Date.now() } : m)),
      false,
    )

    try {
      await apiFetch(`/api/moves/${id}/complete`, { method: "POST" })

      console.log("[v0] completeMove: Move completed, triggering milestone check")
      try {
        const milestoneRes = await fetch("/api/notifications/milestone", { method: "POST" })
        const milestoneData = await milestoneRes.json()
        console.log("[v0] completeMove: Milestone check result", milestoneData)
      } catch (notifyErr) {
        console.log("[v0] completeMove: Milestone notification check failed:", notifyErr)
      }

      globalMutate("/api/metrics/today")
      globalMutate("/api/metrics/clients")
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] completeMove: API failed in preview, using local state")
      // Still refresh metrics in preview mode
      globalMutate("/api/metrics/today")
      globalMutate("/api/metrics/clients")
    }
  }

  const restoreMove = async (id: string, previousStatus: MoveStatus = "today") => {
    if (shouldUseMockMode()) {
      updateLocalMove(id, { status: previousStatus, completedAt: undefined })
    }

    mutate(
      (current: Move[] | undefined) =>
        current?.map((m) => (m.id === id ? { ...m, status: previousStatus, completedAt: undefined } : m)),
      false,
    )

    try {
      await apiFetch(`/api/moves/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusToBackend[previousStatus], completedAt: null }),
      })
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] restoreMove: API failed in preview, using local state")
    }
  }

  const updateMoveStatus = async (id: string, newStatus: MoveStatus, insertAtIndex?: number) => {
    if (shouldUseMockMode()) {
      updateLocalMove(id, { status: newStatus })
    }

    // Calculate the new sortOrder based on insertAtIndex
    let newSortOrder: number | undefined
    if (insertAtIndex !== undefined) {
      const targetMoves = moves
        .filter((m) => m.status === newStatus)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      if (targetMoves.length === 0) {
        newSortOrder = 0
      } else if (insertAtIndex === 0) {
        // Insert at beginning - use sortOrder less than the first item
        newSortOrder = (targetMoves[0]?.sortOrder ?? 0) - 1
      } else if (insertAtIndex >= targetMoves.length) {
        // Insert at end - use sortOrder greater than the last item
        newSortOrder = (targetMoves[targetMoves.length - 1]?.sortOrder ?? 0) + 1
      } else {
        // Insert in middle - use average of surrounding items
        const before = targetMoves[insertAtIndex - 1]?.sortOrder ?? 0
        const after = targetMoves[insertAtIndex]?.sortOrder ?? 0
        newSortOrder = (before + after) / 2
      }
    }

    mutate((current: Move[] | undefined) => {
      if (!current) return current
      const moveToUpdate = current.find((m) => m.id === id)
      if (!moveToUpdate) return current

      const withoutMove = current.filter((m) => m.id !== id)
      const updatedMove = { ...moveToUpdate, status: newStatus, sortOrder: newSortOrder }

      return [...withoutMove, updatedMove]
    }, false)

    try {
      await apiFetch(`/api/moves/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: statusToBackend[newStatus],
          sortOrder: newSortOrder,
        }),
      })
      // Don't call mutate() here - let reorderMoves handle the final state
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] updateMoveStatus: API failed in preview, using local state")
    }
  }

  const reorderMoves = async (status: MoveStatus, orderedIds: string[]) => {
    // Optimistically update local state with new order
    mutate((current: Move[] | undefined) => {
      if (!current) return current
      const statusMoves = current.filter((m) => m.status === status)
      const otherMoves = current.filter((m) => m.status !== status)

      // Reorder and assign new sortOrder values
      const reordered = orderedIds
        .map((id, index) => {
          const move = statusMoves.find((m) => m.id === id)
          if (move) {
            return { ...move, sortOrder: index }
          }
          return null
        })
        .filter((m): m is Move => m !== null)

      return [...otherMoves, ...reordered]
    }, false)

    try {
      await apiFetch(`/api/moves/reorder`, {
        method: "POST",
        body: JSON.stringify({
          status: statusToBackend[status],
          orderedIds: orderedIds.map((id) => Number.parseInt(id, 10)),
        }),
      })
      // Revalidate after successful API call to get confirmed state
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] reorderMoves: API failed in preview, using local state")
    }
  }

  const createMove = async (moveData: {
    title: string
    clientId?: number
    clientName?: string // Accept clientName for display
    description?: string
    status?: MoveStatus
    effortEstimate?: number
    drainType?: string
  }) => {
    const backendStatus = moveData.status ? statusToBackend[moveData.status] : "backlog"
    const targetStatus = moveData.status || "backlog"

    const optimisticId = `temp-${Date.now()}`
    const optimisticMove: Move = {
      id: optimisticId,
      client: moveData.clientName || "",
      clientId: moveData.clientId,
      clientColor: undefined, // Initialize clientColor
      title: moveData.title,
      description: moveData.description,
      type: effortToType(moveData.effortEstimate || 2),
      effortEstimate: moveData.effortEstimate || 2, // Preserve effort estimate
      status: targetStatus,
      ageLabel: "today",
      sortOrder: -1,
    }

    mutate(
      (current: Move[] | undefined) => {
        return current ? [optimisticMove, ...current] : [optimisticMove]
      },
      false, // Don't revalidate yet
    )

    try {
      const response = await apiFetch<BackendMove>("/api/moves", {
        method: "POST",
        body: JSON.stringify({
          title: moveData.title,
          clientId: moveData.clientId || null,
          description: moveData.description || null,
          status: backendStatus,
          effortEstimate: moveData.effortEstimate || 2,
          drainType: moveData.drainType || null,
          sortOrder: -1, // Ensure it's at the top
        }),
      })

      mutate(
        (current: Move[] | undefined) => {
          if (!current) return current
          return current.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  id: response.id.toString(),
                  client: response.clientName || moveData.clientName || "",
                  clientColor: response.client?.color ?? undefined, // Include client color
                }
              : m,
          )
        },
        false, // Don't revalidate - we have the correct data
      )

      return response
    } catch (err) {
      if (shouldUseMockMode()) {
        const localMoveId = `local-${Date.now()}`
        addLocalMove({ ...optimisticMove, id: localMoveId })

        mutate((current: Move[] | undefined) => {
          if (!current) return current
          return current.map((m) => (m.id === optimisticId ? { ...m, id: localMoveId } : m))
        }, false)

        return { id: Number(localMoveId) } as BackendMove
      }

      mutate((current: Move[] | undefined) => {
        if (!current) return current
        return current.filter((m) => m.id !== optimisticId)
      }, false)
      throw err
    }
  }

  const updateMove = async (
    id: string,
    moveData: {
      title?: string
      clientId?: number
      description?: string
      status?: MoveStatus
      effortEstimate?: number
      drainType?: string
    },
  ) => {
    const backendStatus = moveData.status ? statusToBackend[moveData.status] : undefined

    // Optimistic update
    mutate((current: Move[] | undefined) => {
      if (!current) return current
      return current.map((m) => {
        if (m.id !== id) return m
        return {
          ...m,
          title: moveData.title ?? m.title,
          clientId: moveData.clientId ?? m.clientId,
          description: moveData.description ?? m.description,
          status: moveData.status ?? m.status,
          type: moveData.effortEstimate ? effortToType(moveData.effortEstimate) : m.type,
          effortEstimate: moveData.effortEstimate ?? m.effortEstimate, // Preserve effort estimate
        }
      })
    }, false)

    try {
      await apiFetch(`/api/moves/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: moveData.title,
          clientId: moveData.clientId,
          description: moveData.description,
          status: backendStatus,
          effortEstimate: moveData.effortEstimate,
          drainType: moveData.drainType,
        }),
      })
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] updateMove: API failed in preview, using local state")
    }
  }

  const updateSubtasks = async (id: string, subtasks: Subtask[]) => {
    // Optimistic update
    mutate((current: Move[] | undefined) => {
      if (!current) return current
      return current.map((m) => (m.id === id ? { ...m, subtasks } : m))
    }, false)

    try {
      await apiFetch(`/api/moves/${id}`, {
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

  const promoteMove = async (id: string) => {
    return updateMoveStatus(id, "upnext")
  }

  const deleteMove = async (id: string) => {
    // Optimistic update - remove from list
    mutate((current: Move[] | undefined) => {
      if (!current) return current
      return current.filter((m) => m.id !== id)
    }, false)

    try {
      await apiFetch(`/api/moves/${id}`, { method: "DELETE" })
      // Refresh related data
      globalMutate("/api/backlog/grouped")
      globalMutate("/api/backlog/recommendations")
    } catch (err) {
      if (!shouldUseMockMode()) {
        // Revert on error
        mutate()
        throw err
      }
      console.log("[v0] deleteMove: API failed in preview, using local state")
      removeLocalMove(id)
    }
  }

  return {
    moves,
    loading: isLoading,
    isLoading,
    error,
    todayMoves: byStatus("today"),
    upNextMoves: byStatus("upnext"),
    backlogMoves: byStatus("backlog"),
    doneMoves: byStatus("done"),
    completeMove,
    restoreMove,
    updateMoveStatus,
    reorderMoves,
    createMove,
    updateMove,
    updateSubtasks,
    setSubtasksFromTitles,
    promoteMove,
    deleteMove,
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
      console.log("[v0] useClients: fetching from /api/clients")

      let backendClients: BackendClient[] = []
      try {
        backendClients = await apiFetch<BackendClient[]>("/api/clients")
        console.log("[v0] useClients: received from API", backendClients)
      } catch (err) {
        console.log("[v0] useClients: API error, will use mock data if in preview", err)
      }

      const clientsToUse = mergeWithMockData(backendClients, MOCK_CLIENTS as any)
      console.log("[v0] useClients: clientsToUse", clientsToUse)

      const mapped = clientsToUse
        .filter((c) => c.isActive === 1)
        .map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color ?? undefined,
          isActive: c.isActive === 1,
        }))

      console.log("[v0] useClients: returning", mapped)
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
