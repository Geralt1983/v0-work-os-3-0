"use client"

import useSWR from "swr"

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

// =============================================================================
// MOVES HOOK
// =============================================================================
const MOVES_KEY = "moves"

export function useMoves() {
  const { data, error, isLoading, mutate } = useSWR<Move[]>(
    MOVES_KEY,
    async () => {
      const backendMoves = await apiFetch<BackendMove[]>("/api/moves")
      return backendMoves.map((move) => ({
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
    mutate(
      (current: Move[] | undefined) =>
        current?.map((m) => (m.id === id ? { ...m, status: "done" as MoveStatus, completedAt: Date.now() } : m)),
      false,
    )

    await apiFetch(`/api/moves/${id}/complete`, {
      method: "POST",
    })

    mutate()
  }

  const restoreMove = async (id: string, previousStatus: MoveStatus = "today") => {
    mutate(
      (current: Move[] | undefined) =>
        current?.map((m) => (m.id === id ? { ...m, status: previousStatus, completedAt: undefined } : m)),
      false,
    )

    await apiFetch(`/api/moves/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: statusToBackend[previousStatus], completedAt: null }),
    })

    mutate()
  }

  const updateMoveStatus = async (id: string, newStatus: MoveStatus, insertAtIndex?: number) => {
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

    await apiFetch(`/api/moves/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: statusToBackend[newStatus],
        ...(insertAtIndex !== undefined && { sortOrder: insertAtIndex }),
      }),
    })

    mutate()
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

    await apiFetch(`/api/moves/reorder`, {
      method: "POST",
      body: JSON.stringify({
        status: statusToBackend[status],
        orderedIds: orderedIds.map((id) => Number.parseInt(id, 10)),
      }),
    })

    mutate()
  }

  const createMove = async (moveData: {
    title: string
    clientId?: number
    description?: string
    status?: MoveStatus
    effortEstimate?: number
    drainType?: string
  }) => {
    const backendStatus = moveData.status ? statusToBackend[moveData.status] : "backlog"

    const response = await apiFetch<BackendMove>("/api/moves", {
      method: "POST",
      body: JSON.stringify({
        title: moveData.title,
        clientId: moveData.clientId || null,
        description: moveData.description || null,
        status: backendStatus,
        effortEstimate: moveData.effortEstimate || 2,
        drainType: moveData.drainType || null,
      }),
    })

    mutate()
    return response
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
    createMove, // Export createMove
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
      const backendClients = await apiFetch<BackendClient[]>("/api/clients")
      console.log("[v0] useClients: received", backendClients)

      const mapped = backendClients
        .filter((c) => c.isActive === 1)
        .map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color ?? undefined,
          isActive: c.isActive === 1,
        }))

      console.log("[v0] useClients: mapped to", mapped)
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
