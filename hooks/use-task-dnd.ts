/**
 * Custom hook for task drag-and-drop functionality.
 * Extracts DnD logic from tasks/page.tsx to improve maintainability.
 */

import { useState, useCallback } from "react"
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import type { Task } from "@/hooks/use-tasks"

export type TaskStatus = "today" | "upnext" | "backlog" | "done"

export interface DraggedItems {
  today: Task[]
  upnext: Task[]
}

export interface UseTaskDndReturn {
  // Sensors
  sensors: ReturnType<typeof useSensors>

  // Drag state
  activeId: string | null
  activeTask: Task | undefined
  draggedItems: DraggedItems | null
  recentlyDropped: string | null

  // Event handlers
  handleDragStart: (event: DragStartEvent) => void
  handleDragOver: (event: DragOverEvent) => void
  handleDragEnd: (
    event: DragEndEvent,
    callbacks: {
      updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>
      reorderTasks: (status: TaskStatus, taskIds: string[]) => Promise<void>
    }
  ) => Promise<void>
  handleDragCancel: () => void
}

/**
 * Hook for managing task drag-and-drop state and handlers.
 *
 * @param tasks - Array of all tasks
 * @returns DnD state and event handlers
 *
 * @example
 * ```tsx
 * const {
 *   sensors,
 *   activeId,
 *   handleDragStart,
 *   handleDragEnd,
 * } = useTaskDnd(tasks)
 * ```
 */
export function useTaskDnd(tasks: Task[]): UseTaskDndReturn {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedItems, setDraggedItems] = useState<DraggedItems | null>(null)
  const [recentlyDropped, setRecentlyDropped] = useState<string | null>(null)

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Find the active task
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : undefined

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string)
      setDraggedItems({
        today: tasks.filter((t) => t.status === "today"),
        upnext: tasks.filter((t) => t.status === "upnext"),
      })
    },
    [tasks]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over || !draggedItems) return

      const activeId = active.id as string
      const overId = over.id as string

      // Determine source and target columns
      const activeInToday = draggedItems.today.some((t) => t.id === activeId)
      const activeInUpnext = draggedItems.upnext.some((t) => t.id === activeId)

      const overIsColumn = overId === "today-column" || overId === "upnext-column"
      const overInToday = draggedItems.today.some((t) => t.id === overId)
      const overInUpnext = draggedItems.upnext.some((t) => t.id === overId)

      // Determine target column
      let targetColumn: "today" | "upnext" | null = null
      if (overId === "today-column" || overInToday) {
        targetColumn = "today"
      } else if (overId === "upnext-column" || overInUpnext) {
        targetColumn = "upnext"
      }

      if (!targetColumn) return

      // If moving to a different column, update the dragged items
      const sourceColumn = activeInToday ? "today" : activeInUpnext ? "upnext" : null
      if (sourceColumn && sourceColumn !== targetColumn) {
        const activeTask = tasks.find((t) => t.id === activeId)
        if (!activeTask) return

        setDraggedItems((prev) => {
          if (!prev) return prev
          const newItems = { ...prev }

          // Remove from source
          newItems[sourceColumn] = prev[sourceColumn].filter((t) => t.id !== activeId)

          // Add to target
          if (!overIsColumn) {
            // Insert at specific position
            const overIndex = prev[targetColumn].findIndex((t) => t.id === overId)
            newItems[targetColumn] = [
              ...prev[targetColumn].slice(0, overIndex),
              activeTask,
              ...prev[targetColumn].slice(overIndex),
            ]
          } else {
            // Add to end
            newItems[targetColumn] = [...prev[targetColumn], activeTask]
          }

          return newItems
        })
      }
    },
    [draggedItems, tasks]
  )

  const handleDragEnd = useCallback(
    async (
      event: DragEndEvent,
      callbacks: {
        updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>
        reorderTasks: (status: TaskStatus, taskIds: string[]) => Promise<void>
      }
    ) => {
      const { active, over } = event
      setActiveId(null)

      const finalItems = draggedItems
      setDraggedItems(null)

      if (!over || !finalItems) return

      const activeId = active.id as string
      const overId = over.id as string

      const draggedTask = tasks.find((t) => t.id === activeId)
      if (!draggedTask) return

      // Determine target status and index
      let targetStatus: TaskStatus | null = null
      let targetIndex = 0

      if (overId === "today-column") {
        targetStatus = "today"
        targetIndex = finalItems.today.length
      } else if (overId === "upnext-column") {
        targetStatus = "upnext"
        targetIndex = finalItems.upnext.length
      } else {
        // Dropped on another task
        const todayIndex = finalItems.today.findIndex((t) => t.id === overId)
        const upnextIndex = finalItems.upnext.findIndex((t) => t.id === overId)

        if (todayIndex >= 0) {
          targetStatus = "today"
          targetIndex = todayIndex
        } else if (upnextIndex >= 0) {
          targetStatus = "upnext"
          targetIndex = upnextIndex
        }
      }

      if (!targetStatus) return

      // Update status if changed
      if (draggedTask.status !== targetStatus) {
        await callbacks.updateTaskStatus(activeId, targetStatus)
        setRecentlyDropped(activeId)
        setTimeout(() => setRecentlyDropped(null), 500)
      }

      // Reorder tasks
      const targetList =
        targetStatus === "today" ? finalItems.today : finalItems.upnext
      const newOrder = targetList.map((t) => t.id)
      await callbacks.reorderTasks(targetStatus, newOrder)
    },
    [draggedItems, tasks]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setDraggedItems(null)
  }, [])

  return {
    sensors,
    activeId,
    activeTask,
    draggedItems,
    recentlyDropped,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}

export default useTaskDnd
