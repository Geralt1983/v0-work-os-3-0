"use client"

import useSWR from "swr"
import { api, type Move, type MoveStatus } from "@/lib/mock-api"

const MOVES_KEY = "moves"

export function useMoves() {
  const { data, error, isLoading, mutate } = useSWR<Move[]>(MOVES_KEY, () => api.moves.list())

  const moves = data ?? []

  const byStatus = (status: MoveStatus) => moves.filter((m) => m.status === status)

  const completeMove = async (id: string) => {
    mutate(
      (current: Move[] | undefined) =>
        current?.map((m) => (m.id === id ? { ...m, status: "done" as MoveStatus, completedAt: Date.now() } : m)),
      false,
    )
    await api.moves.complete(id)
    mutate()
  }

  const restoreMove = async (id: string, previousStatus: MoveStatus = "today") => {
    mutate(
      (current: Move[] | undefined) =>
        current?.map((m) => (m.id === id ? { ...m, status: previousStatus, completedAt: undefined } : m)),
      false,
    )
    await api.moves.requeue(id, previousStatus)
    mutate()
  }

  const updateMoveStatus = async (id: string, newStatus: MoveStatus, insertAtIndex?: number) => {
    mutate((current: Move[] | undefined) => {
      if (!current) return current

      const moveToUpdate = current.find((m) => m.id === id)
      if (!moveToUpdate) return current

      // Remove from current position
      const withoutMove = current.filter((m) => m.id !== id)
      const updatedMove = { ...moveToUpdate, status: newStatus }

      if (insertAtIndex !== undefined) {
        // Get moves in target status (before our move)
        const targetMoves = withoutMove.filter((m) => m.status === newStatus)
        const otherMoves = withoutMove.filter((m) => m.status !== newStatus)

        // Insert at specific index within target column
        const newTargetMoves = [
          ...targetMoves.slice(0, insertAtIndex),
          updatedMove,
          ...targetMoves.slice(insertAtIndex),
        ]

        return [...otherMoves, ...newTargetMoves]
      }

      // Default: append to end
      return [...withoutMove, updatedMove]
    }, false)

    await api.moves.updateStatus(id, newStatus)
    mutate()
  }

  const reorderMoves = async (status: MoveStatus, orderedIds: string[]) => {
    mutate((current: Move[] | undefined) => {
      if (!current) return current

      const statusMoves = current.filter((m) => m.status === status)
      const otherMoves = current.filter((m) => m.status !== status)

      // Reorder status moves according to orderedIds
      const reordered = orderedIds
        .map((id) => statusMoves.find((m) => m.id === id))
        .filter((m): m is Move => m !== undefined)

      return [...otherMoves, ...reordered]
    }, false)

    await api.moves.reorder(status, orderedIds)
    mutate()
  }

  return {
    moves,
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
  }
}
