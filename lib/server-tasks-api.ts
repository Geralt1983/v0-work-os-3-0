// Server API wrapper for moves
import { apiRequest } from "./api-client"

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
  effortEstimate?: number
  effortActual?: number
}

const BASE = "/api/moves"

export async function listMoves(): Promise<Move[]> {
  return apiRequest<Move[]>(BASE)
}

export async function getMove(id: string): Promise<Move> {
  return apiRequest<Move>(`${BASE}/${id}`)
}

export async function createMove(payload: Partial<Move>): Promise<Move> {
  return apiRequest<Move>(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateMove(id: string, payload: Partial<Move>): Promise<Move> {
  return apiRequest<Move>(`${BASE}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function deleteMove(id: string): Promise<void> {
  return apiRequest<void>(`${BASE}/${id}`, {
    method: "DELETE",
  })
}

export async function completeMove(id: string, effortActual?: number): Promise<Move> {
  return apiRequest<Move>(`${BASE}/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ effortActual }),
  })
}

export async function promoteMove(id: string): Promise<Move> {
  return apiRequest<Move>(`${BASE}/${id}/promote`, {
    method: "POST",
  })
}

export async function demoteMove(id: string): Promise<Move> {
  return apiRequest<Move>(`${BASE}/${id}/demote`, {
    method: "POST",
  })
}

export async function suggestRename(id: string, text: string): Promise<{ suggestion: string }> {
  return apiRequest<{ suggestion: string }>(`${BASE}/${id}/suggest-rename`, {
    method: "POST",
    body: JSON.stringify({ text }),
  })
}

export async function breakdown(id: string): Promise<{ subtasks: string[] }> {
  return apiRequest<{ subtasks: string[] }>(`${BASE}/${id}/breakdown`, {
    method: "POST",
  })
}
