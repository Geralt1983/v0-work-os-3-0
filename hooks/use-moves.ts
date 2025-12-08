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
  createdAt: string
  updatedAt: string
  completedAt: string | null
  clientName?: string
  client?: { id: number; name: string }
}

export interface Move {
  id: string
  client: string
  clientId?: number
  title: string
  description?: string
  type: "Quick" | "Standard" | "Chunky" | "Deep"
  status: MoveStatus
  movesCount?: number
  ageLabel?: string
  completedAt?: number
  sortOrder?: number
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
        title: move.title,
        description: move.description ?? undefined,
        type: effortToType(move.effortEstimate),
        status: statusToFrontend[move.status],
        movesCount: undefined,
        ageLabel: getAgeLabel(move.createdAt),
        completedAt: move.completedAt ? new Date(move.completedAt).getTime() : undefined,
        sortOrder: move.sortOrder ?? undefined,
      }))

      if (isPreviewEnvironment()) {
        const localMovesData = getLocalMoves()
        // Get IDs of moves from API/mock to avoid duplicates
        const apiMoveIds = new Set(mappedMoves.map((m) => m.id))
        // Add local moves that don't exist in API response
        const uniqueLocalMoves = localMovesData.filter((m) => !apiMoveIds.has(m.id))
        // Local moves go first (newest at top), then API moves
        return [...uniqueLocalMoves, ...mappedMoves]
      }

      return mappedMoves
    },
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
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

    mutate((current: Move[] | undefined) => {
      if (!current) return current
      const moveToUpdate = current.find((m) => m.id === id)
      if (!moveToUpdate) return current

      const withoutMove = current.filter((m) => m.id !== id)
      const updatedMove = { ...moveToUpdate, status: newStatus }

      if (insertAtIndex !== undefined) {
        const targetMoves = withoutMove.filter((m) => m.status === newStatus)
        const otherMoves = withoutMove.filter((m) => m.status !== newStatus)
        const newTargetMoves = [
          ...targetMoves.slice(0, insertAtIndex),
          updatedMove,
          ...targetMoves.slice(insertAtIndex),
        ]
        return [...otherMoves, ...newTargetMoves]
      }

      return [...withoutMove, updatedMove]
    }, false)

    try {
      await apiFetch(`/api/moves/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: statusToBackend[newStatus],
          ...(insertAtIndex !== undefined && { sortOrder: insertAtIndex }),
        }),
      })
      mutate()
    } catch (err) {
      if (!shouldUseMockMode()) throw err
      console.log("[v0] updateMoveStatus: API failed in preview, using local state")
    }
  }

  const reorderMoves = async (status: MoveStatus, orderedIds: string[]) => {
    mutate((current: Move[] | undefined) => {
      if (!current) return current
      const statusMoves = current.filter((m) => m.status === status)
      const otherMoves = current.filter((m) => m.status !== status)
      const reordered = orderedIds
        .map((id) => statusMoves.find((m) => m.id === id))
        .filter((m): m is Move => m !== undefined)
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
      title: moveData.title,
      description: moveData.description,
      type: effortToType(moveData.effortEstimate || 2),
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
