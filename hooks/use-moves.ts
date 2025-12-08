"use client"

import useSWR from "swr"

// =============================================================================
// API CONFIGURATION
// =============================================================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://daily-work-os-agent.replit.app"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
// Work-OS backend status values
export type BackendMoveStatus = "active" | "queued" | "backlog" | "done"

// v0 UI status values (what the components expect)
export type MoveStatus = "today" | "upnext" | "backlog" | "done"

// Backend Move shape (from Work-OS /api/moves)
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

// Frontend Move shape (what v0 UI components expect)
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

  console.log("[v0] apiFetch:", url)

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  console.log("[v0] apiFetch response:", res.status, res.ok)

  if (!res.ok) {
    const error = await res.text().catch(() => "Unknown error")
    console.log("[v0] apiFetch error:", error)
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
      console.log("[v0] Fetching moves from:", `${API_BASE_URL}/api/moves`)
      const backendMoves = await apiFetch<BackendMove[]>("/api/moves")
      console.log("[v0] Got moves:", backendMoves.length, backendMoves)
      return backendMoves.map((move) => ({
        id: move.id.toString(),
        client: move.clientName ?? (move.client ? move.client.name : ""),
        clientId: move.clientId,
        title: move.title,
        description: move.description,
        type: effortToType(move.effortEstimate),
        status: statusToFrontend[move.status],
        movesCount: undefined,
        ageLabel: getAgeLabel(move.createdAt),
        completedAt: move.completedAt ? new Date(move.completedAt).getTime() : undefined,
        sortOrder: move.sortOrder,
      }))
    },
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    },
  )

  console.log("[v0] useMoves state:", { isLoading, error: error?.message, movesCount: data?.length })

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

    await apiFetch(`/api/moves/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
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
      body: JSON.stringify({ status: statusToBackend[previousStatus] }),
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
  const { data, error, isLoading } = useSWR<Client[]>("clients", async () => {
    const backendClients = await apiFetch<BackendClient[]>("/api/clients")
    return backendClients
      .filter((c) => c.isActive === 1)
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color ?? undefined,
        isActive: c.isActive === 1,
      }))
  })

  return {
    clients: data ?? [],
    isLoading,
    error,
  }
}

function transformMove(move: BackendMove): Move {
  return {
    id: move.id.toString(),
    client: move.clientName ?? (move.client ? move.client.name : ""),
    clientId: move.clientId,
    title: move.title,
    description: move.description,
    type: effortToType(move.effortEstimate),
    status: statusToFrontend[move.status],
    movesCount: undefined,
    ageLabel: getAgeLabel(move.createdAt),
    completedAt: move.completedAt ? new Date(move.completedAt).getTime() : undefined,
    sortOrder: move.sortOrder,
  }
}
