// Mock API layer for moves data
// This simulates a backend - replace with real API calls later

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

// In-memory store (simulates database)
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

export const api = {
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
      // Get all moves not in this status (preserve their order)
      const otherMoves = moves.filter((m) => m.status !== status)
      // Reorder the status moves according to orderedIds
      const statusMoves = orderedIds
        .map((id) => moves.find((m) => m.id === id && m.status === status))
        .filter((m): m is Move => m !== undefined)

      // Clear and rebuild the moves array
      moves.length = 0
      moves.push(...otherMoves, ...statusMoves)
    },
  },
}
