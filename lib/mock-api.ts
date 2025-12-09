// Mock API layer for moves data
// Switches between mock data and real server based on NEXT_PUBLIC_USE_SERVER env var

import { USE_SERVER } from "./api-client"
import * as serverMovesApi from "./server-moves-api"

export function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") {
    // Server-side: check for DATABASE_URL
    return !process.env.DATABASE_URL
  }
  // Client-side: check if running in v0 preview
  const hostname = window.location.hostname
  return hostname.includes("vfs.cloud") || hostname.includes("v0.dev") || hostname === "localhost"
}

export type MoveStatus = "today" | "upnext" | "backlog" | "done"
export type MoveType = "Quick" | "Chunky" | "Standard"

export interface Move {
  id: string
  client: string
  title: string
  type: MoveType
  status: MoveStatus
  movesCount?: number
  ageLabel?: string
  completedAt?: number
}

// In-memory store (simulates database) - only used when USE_SERVER is false
const moves: Move[] = [
  // Today
  {
    id: "1",
    client: "Orlando",
    title: "Email picture for Teams",
    type: "Quick",
    status: "today",
    movesCount: 3,
    ageLabel: "Today",
  },
  {
    id: "2",
    client: "Raleigh",
    title: "Force Cosign box on restraints",
    type: "Chunky",
    status: "today",
    movesCount: 5,
    ageLabel: "1d ago",
  },
  {
    id: "3",
    client: "Memphis",
    title: "Review and provide feedback on Evan's order set configuration",
    type: "Standard",
    status: "today",
    movesCount: 2,
    ageLabel: "Today",
  },
  // Up Next
  {
    id: "4",
    client: "Orlando",
    title: "Export consults",
    type: "Standard",
    status: "upnext",
    movesCount: 1,
    ageLabel: "2d ago",
  },
  {
    id: "5",
    client: "Memphis",
    title: "Review Yale referral logic for organ donor (#6156)",
    type: "Standard",
    status: "upnext",
    movesCount: 4,
    ageLabel: "1d ago",
  },
  {
    id: "6",
    client: "Raleigh",
    title: "Look at 60k OTx errors and give analysis",
    type: "Chunky",
    status: "upnext",
    movesCount: 2,
    ageLabel: "3d ago",
  },
  // Backlog
  {
    id: "7",
    client: "Memphis",
    title: "Confirm with Beverly on MORA organ donor orders",
    type: "Standard",
    status: "backlog",
  },
  {
    id: "8",
    client: "Memphis",
    title: "Align education for VTE language standardization",
    type: "Standard",
    status: "backlog",
  },
  {
    id: "9",
    client: "Memphis",
    title: "Evaluate workflow for consult to IP hospice",
    type: "Standard",
    status: "backlog",
  },
  {
    id: "10",
    client: "Memphis",
    title: "Coordinate PEDS fever order set updates",
    type: "Standard",
    status: "backlog",
  },
  {
    id: "11",
    client: "Memphis",
    title: "Wrap up validation for wound care order set",
    type: "Standard",
    status: "backlog",
  },
  { id: "12", client: "Memphis", title: "Complete Wave 1 for Orion tasks", type: "Standard", status: "backlog" },
]

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock implementations
const mockApi = {
  moves: {
    async list(): Promise<Move[]> {
      await delay(50)
      return [...moves]
    },

    async complete(id: string): Promise<Move> {
      await delay(100)
      const move = moves.find((m) => m.id === id)
      if (!move) throw new Error(`Move ${id} not found`)

      move.status = "done"
      move.completedAt = Date.now()
      return { ...move }
    },

    async requeue(id: string, status: MoveStatus = "backlog"): Promise<Move> {
      await delay(100)
      const move = moves.find((m) => m.id === id)
      if (!move) throw new Error(`Move ${id} not found`)

      move.status = status
      move.completedAt = undefined
      return { ...move }
    },

    async updateStatus(id: string, newStatus: MoveStatus): Promise<Move> {
      await delay(50)
      const move = moves.find((m) => m.id === id)
      if (!move) throw new Error(`Move ${id} not found`)

      move.status = newStatus
      return { ...move }
    },

    async reorder(status: MoveStatus, orderedIds: string[]): Promise<void> {
      await delay(50)
      const otherMoves = moves.filter((m) => m.status !== status)
      const statusMoves = orderedIds
        .map((id) => moves.find((m) => m.id === id && m.status === status))
        .filter((m): m is Move => m !== undefined)

      moves.length = 0
      moves.push(...otherMoves, ...statusMoves)
    },
  },
}

const serverApi = {
  moves: {
    async list(): Promise<Move[]> {
      const result = await serverMovesApi.listMoves()
      return result as Move[]
    },

    async complete(id: string): Promise<Move> {
      const result = await serverMovesApi.completeMove(id)
      return result as Move
    },

    async requeue(id: string, status: MoveStatus = "backlog"): Promise<Move> {
      // Use demote endpoint for backlog, or updateMove for specific status
      if (status === "backlog") {
        const result = await serverMovesApi.demoteMove(id)
        return result as Move
      }
      const result = await serverMovesApi.updateMove(id, { status })
      return result as Move
    },

    async updateStatus(id: string, newStatus: MoveStatus): Promise<Move> {
      const result = await serverMovesApi.updateMove(id, { status: newStatus })
      return result as Move
    },

    async reorder(status: MoveStatus, orderedIds: string[]): Promise<void> {
      // Server may not have a direct reorder endpoint, so we update each move's order
      // For now, this is a no-op on the server side - order is determined by fetch
      console.log("[v0] Reorder called with", status, orderedIds)
    },
  },
}

export const api = USE_SERVER ? serverApi : mockApi
