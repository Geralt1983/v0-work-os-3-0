"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Check,
  Archive,
  LayoutGrid,
  List,
  Focus,
  Zap,
  FileText,
  Layers,
  Clock,
  ArrowUp,
  ArrowDown,
  CheckSquare,
} from "lucide-react"
import { useMoves, type Move, type MoveStatus, useClients } from "@/hooks/use-moves"
import { WorkOSNav } from "@/components/work-os-nav"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { NewMoveDialog } from "@/components/new-move-dialog"
import { EditMoveDialog } from "@/components/edit-move-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { SynapsePicks } from "@/components/synapse-picks"
import { Graveyard } from "@/components/graveyard"
import { DoneToday } from "@/components/done-today"

type MoveVariant = "primary" | "compact"
type MovesView = "board" | "list" | "focus"
type SortKey = "client" | "status" | "type"
type SortDir = "asc" | "desc"

const mobileTabs: { key: MoveStatus; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upnext", label: "Up Next" },
  { key: "backlog", label: "Backlog" },
]

export default function MovesPage() {
  const {
    moves,
    loading,
    todayMoves,
    upNextMoves,
    backlogMoves,
    doneMoves,
    completeMove,
    restoreMove,
    reorderMoves,
    updateMoveStatus,
    createMove,
    updateMove,
    updateSubtasks,
    setSubtasksFromTitles,
  } = useMoves()
  const { clients } = useClients()

  const [view, setView] = useState<MovesView>("board")
  const [clientFilter, setClientFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<MoveStatus>("today")
  const [showBacklog, setShowBacklog] = useState(true)
  const [showNewMoveDialog, setShowNewMoveDialog] = useState(false)
  const [undoState, setUndoState] = useState<{ id: string; previousStatus: MoveStatus } | null>(null)
  const [editingMove, setEditingMove] = useState<Move | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clientOptions = useMemo(() => [...new Set(moves.map((m) => m.client).filter(Boolean))], [moves])

  const enrichedMoves = useMemo(() => {
    return moves.map((move) => {
      const clientMoves = moves.filter((m) => m.client === move.client && m.status !== "done")
      return { ...move, movesCount: clientMoves.length }
    })
  }, [moves])

  const handleComplete = async (id: string, previousStatus: MoveStatus = "today") => {
    await completeMove(id)
    setUndoState({ id, previousStatus })
    if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current)
    undoTimeoutRef.current = window.setTimeout(() => setUndoState(null), 4000)
  }

  const handleUndo = () => {
    if (!undoState) return
    restoreMove(undoState.id, undoState.previousStatus)
    setUndoState(null)
    if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current)
  }

  const handleCreateSubtasks = async (subtasks: string[]) => {
    if (!editingMove) return

    // Create each subtask as a new move with the same client and status
    for (const subtaskTitle of subtasks) {
      await createMove({
        title: subtaskTitle,
        clientId: editingMove.clientId,
        clientName: editingMove.client,
        status: editingMove.status === "done" ? "today" : editingMove.status,
        effortEstimate: 1, // Quick tasks
      })
    }
  }

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current)
    }
  }, [])

  const filteredMoves = useMemo(() => {
    if (!enrichedMoves.length) return []
    if (clientFilter === "all") return enrichedMoves
    return enrichedMoves.filter((m) => m.client === clientFilter)
  }, [enrichedMoves, clientFilter])

  const byStatus = useMemo(
    () => ({
      today: filteredMoves.filter((m) => m.status === "today"),
      upnext: filteredMoves.filter((m) => m.status === "upnext"),
      backlog: filteredMoves.filter((m) => m.status === "backlog"),
      done: filteredMoves.filter((m) => m.status === "done"),
    }),
    [filteredMoves],
  )

  const visibleMobileTabs = showBacklog ? mobileTabs : mobileTabs.filter((tab) => tab.key !== "backlog")

  useEffect(() => {
    if (!showBacklog && activeTab === "backlog") setActiveTab("today")
  }, [showBacklog, activeTab])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 md:text-3xl">Moves</h1>
            <p className="hidden sm:block text-sm text-white/60 mt-1">One move per client, every day.</p>
          </div>
          <div className="flex-shrink-0 pt-1">
            <WorkOSNav active="moves" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 md:flex-none md:w-auto">
            <FilterSelect
              value={clientFilter}
              onValueChange={setClientFilter}
              options={[{ value: "all", label: "All Clients" }, ...clientOptions.map((c) => ({ value: c, label: c }))]}
              fullWidth
              ariaLabel="Client Filter"
            />
          </div>

          <button
            onClick={() => setShowBacklog((prev) => !prev)}
            className={`
              flex items-center justify-center
              h-9 w-9 md:w-auto md:px-3 md:py-1.5
              rounded-full text-xs font-medium
              transition
              ${
                showBacklog
                  ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40"
                  : "bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800"
              }
            `}
            title={showBacklog ? "Hide Backlog" : "Show Backlog"}
          >
            <Archive className="h-4 w-4 md:hidden" />
            <span className="hidden md:inline">{showBacklog ? "Hide Backlog" : "Show Backlog"}</span>
          </button>

          <button
            onClick={() => setShowNewMoveDialog(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-fuchsia-500 px-4 text-sm font-medium text-white hover:bg-fuchsia-600 transition"
          >
            <span className="hidden md:inline text-lg leading-none">+</span>
            <span>New</span>
          </button>
        </div>

        <NewMoveDialog open={showNewMoveDialog} onClose={() => setShowNewMoveDialog(false)} onSubmit={createMove} />
        <EditMoveDialog
          open={editingMove !== null}
          move={editingMove}
          onClose={() => setEditingMove(null)}
          onSave={updateMove}
          onCreateSubtasks={handleCreateSubtasks}
          onUpdateSubtasks={updateSubtasks}
          onSetSubtasksFromTitles={setSubtasksFromTitles}
        />

        <div className="mt-3 flex flex-col gap-3">
          <div className="lg:hidden flex items-center gap-1 p-1 rounded-full bg-zinc-900/50">
            {visibleMobileTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition ${activeTab === tab.key ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                {tab.key === "today" && activeTab === "today" && <Check className="h-3.5 w-3.5" />}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center justify-between">
            <ViewToggle view={view} onChange={setView} />
            <div className="flex items-center gap-2">
              <FilterSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "today", label: "Today" },
                  { value: "upnext", label: "Up Next" },
                  { value: "backlog", label: "Backlog" },
                ]}
                ariaLabel="Status Filter"
              />
              <FilterSelect
                value={typeFilter}
                onValueChange={setTypeFilter}
                options={[
                  { value: "all", label: "All Types" },
                  { value: "Quick", label: "Quick" },
                  { value: "Standard", label: "Standard" },
                  { value: "Deep", label: "Deep" },
                ]}
                ariaLabel="Type Filter"
              />
            </div>
          </div>
        </div>

        {/* Synapse Picks always visible above the board */}
        <div className="hidden lg:block mt-6">
          <SynapsePicks />
        </div>

        <div className="lg:hidden mt-4">
          <MovesListMobile
            moves={byStatus[activeTab] || []}
            activeTab={activeTab}
            onComplete={handleComplete}
            onEditMove={setEditingMove}
          />
        </div>

        <div className="hidden lg:block mt-6">
          {view === "board" && (
            <MovesBoard
              showBacklog={showBacklog}
              todayMoves={byStatus.today}
              upNextMoves={byStatus.upnext}
              backlogMoves={byStatus.backlog}
              doneMoves={byStatus.done}
              onComplete={handleComplete}
              onReorder={reorderMoves}
              onMoveToColumn={updateMoveStatus}
              onEditMove={setEditingMove}
            />
          )}
          {view === "list" && (
            <MovesList moves={filteredMoves} onComplete={handleComplete} onEditMove={setEditingMove} />
          )}
          {view === "focus" && <FocusView moves={byStatus.today} onComplete={handleComplete} />}
        </div>

        {/* Graveyard button at the bottom */}
        <div className="hidden lg:flex justify-center mt-8">
          <Graveyard />
        </div>

        {/* DoneToday component */}
        <div className="mt-8">
          <DoneToday />
        </div>
      </div>
      <UndoToast undoState={undoState} onUndo={handleUndo} />
    </div>
  )
}

function MovesListMobile({
  moves,
  activeTab,
  onComplete,
  onEditMove,
}: {
  moves: Move[]
  activeTab: MoveStatus
  onComplete: (id: string, previousStatus: MoveStatus) => Promise<void>
  onEditMove?: (move: Move) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {moves.length === 0 && <div className="text-center py-12 text-zinc-500">No moves in this category</div>}
      {moves.map((move) => (
        <MoveCard
          key={move.id}
          move={move}
          variant="primary"
          onComplete={(id) => onComplete(id, activeTab)}
          onClick={() => onEditMove?.(move)}
        />
      ))}
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: MovesView; onChange: (v: MovesView) => void }) {
  return (
    <div className="inline-flex rounded-full bg-zinc-900 p-1">
      <button
        onClick={() => onChange("board")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${view === "board" ? "bg-fuchsia-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Board
      </button>
      <button
        onClick={() => onChange("list")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${view === "list" ? "bg-fuchsia-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
      >
        <List className="h-3.5 w-3.5" /> List
      </button>
      <button
        onClick={() => onChange("focus")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${view === "focus" ? "bg-fuchsia-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
      >
        <Focus className="h-3.5 w-3.5" /> Focus
      </button>
    </div>
  )
}

function FilterSelect({
  value,
  onValueChange,
  options,
  fullWidth,
  ariaLabel,
}: {
  value: string
  onValueChange: (v: string) => void
  options: { value: string; label: string }[]
  fullWidth?: boolean
  ariaLabel: string
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={`h-9 rounded-full bg-zinc-900 border-zinc-800 text-zinc-100 ${fullWidth ? "w-full" : "w-auto min-w-[140px]"}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4} className="rounded-xl bg-zinc-900 border-zinc-800 z-[100]">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const columns: { id: MoveStatus; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upnext", label: "Up Next" },
  { id: "backlog", label: "Backlog" },
]

function MovesBoard({
  showBacklog,
  todayMoves,
  upNextMoves,
  backlogMoves,
  doneMoves,
  onComplete,
  onReorder,
  onMoveToColumn,
  onEditMove,
}: {
  showBacklog: boolean
  todayMoves: Move[]
  upNextMoves: Move[]
  backlogMoves: Move[]
  doneMoves: Move[]
  onComplete: (id: string) => Promise<void>
  onReorder: (status: MoveStatus, orderedIds: string[]) => Promise<void>
  onMoveToColumn: (id: string, newStatus: MoveStatus, insertAtIndex?: number) => Promise<void>
  onEditMove?: (move: Move) => void
}) {
  const isMobile = useIsMobile()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localMoves, setLocalMoves] = useState<Record<MoveStatus, Move[]>>({
    today: todayMoves,
    upnext: upNextMoves,
    backlog: backlogMoves,
    done: doneMoves,
  })

  // Sync local state with props
  useEffect(() => {
    setLocalMoves({
      today: todayMoves,
      upnext: upNextMoves,
      backlog: backlogMoves,
      done: doneMoves,
    })
  }, [todayMoves, upNextMoves, backlogMoves, doneMoves])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const findColumn = (id: string): MoveStatus | null => {
    for (const [status, moves] of Object.entries(localMoves)) {
      if (moves.some((m) => m.id === id)) {
        return status as MoveStatus
      }
    }
    return null
  }

  const activeMove = activeId
    ? Object.values(localMoves)
        .flat()
        .find((m) => m.id === activeId)
    : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeColumn = findColumn(activeId)
    let overColumn = findColumn(overId)

    // Check if we're over a column itself (empty column)
    if (!overColumn && columns.some((c) => c.id === overId)) {
      overColumn = overId as MoveStatus
    }

    if (!activeColumn || !overColumn || activeColumn === overColumn) return

    setLocalMoves((prev) => {
      const activeItems = [...prev[activeColumn]]
      const overItems = [...prev[overColumn]]
      const activeIndex = activeItems.findIndex((m) => m.id === activeId)
      const overIndex = overItems.findIndex((m) => m.id === overId)

      const [movedItem] = activeItems.splice(activeIndex, 1)
      const updatedItem = { ...movedItem, status: overColumn }

      const insertIndex = overIndex >= 0 ? overIndex : overItems.length
      overItems.splice(insertIndex, 0, updatedItem)

      return {
        ...prev,
        [activeColumn]: activeItems,
        [overColumn]: overItems,
      }
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeColumn = findColumn(activeId)
    let overColumn = findColumn(overId)

    // Check if we're over a column itself
    if (!overColumn && columns.some((c) => c.id === overId)) {
      overColumn = overId as MoveStatus
    }

    if (!activeColumn) return

    if (activeColumn === overColumn && overColumn) {
      // Reorder within same column
      const items = localMoves[overColumn]
      const oldIndex = items.findIndex((m) => m.id === activeId)
      const newIndex = items.findIndex((m) => m.id === overId)

      if (oldIndex !== newIndex && newIndex >= 0) {
        const newItems = arrayMove(items, oldIndex, newIndex)
        setLocalMoves((prev) => ({ ...prev, [overColumn]: newItems }))
        await onReorder(
          overColumn,
          newItems.map((m) => m.id),
        )
      }
    } else if (overColumn) {
      // Move to different column
      const overItems = localMoves[overColumn]
      const insertIndex = overItems.findIndex((m) => m.id === overId)
      await onMoveToColumn(activeId, overColumn, insertIndex >= 0 ? insertIndex : undefined)
    }
  }

  const visibleColumns = showBacklog ? columns : columns.filter((c) => c.id !== "backlog")

  // Mobile: no drag and drop
  if (isMobile) {
    return (
      <div className="mt-6 w-full grid grid-cols-1 gap-10 lg:grid-cols-3">
        {visibleColumns.map((col) => {
          const columnMoves = localMoves[col.id] || []
          return (
            <MoveColumnStatic
              key={col.id}
              id={col.id}
              title={col.label}
              count={columnMoves.length}
              moves={columnMoves}
              onComplete={onComplete}
              variant={col.id === "backlog" ? "compact" : "primary"}
              scrollable={col.id === "backlog"}
            />
          )
        })}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="mt-6 w-full grid grid-cols-1 gap-10 lg:grid-cols-3">
        {visibleColumns.map((col) => {
          const columnMoves = localMoves[col.id] || []
          return (
            <DroppableColumn
              key={col.id}
              id={col.id}
              title={col.label}
              count={columnMoves.length}
              moves={columnMoves}
              onComplete={onComplete}
              variant={col.id === "backlog" ? "compact" : "primary"}
              scrollable={col.id === "backlog"}
              onEditMove={onEditMove}
            />
          )
        })}
      </div>
      <DragOverlay>
        {activeMove ? (
          <div className="opacity-90">
            <MoveCard move={activeMove} variant="primary" onComplete={() => Promise.resolve()} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// Static column for mobile (no drag)
function MoveColumnStatic({
  id,
  title,
  count,
  moves,
  onComplete,
  variant,
  scrollable,
}: {
  id: MoveStatus
  title: string
  count: number
  moves: Move[]
  onComplete: (id: string) => Promise<void>
  variant: MoveVariant
  scrollable?: boolean
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] text-zinc-300">
          {count}
        </span>
      </div>
      <div className="mb-4 border-b border-zinc-800/60" />
      <div className={`min-h-[100px] rounded-2xl ${scrollable ? "max-h-[72vh] overflow-y-auto pr-1" : ""}`}>
        <div className="flex flex-col gap-3">
          {moves.map((move) => (
            <MoveCard key={move.id} move={move} variant={variant} onComplete={onComplete} />
          ))}
        </div>
      </div>
    </section>
  )
}

// Droppable column with sortable items
function DroppableColumn({
  id,
  title,
  count,
  moves,
  onComplete,
  variant,
  scrollable,
  onEditMove,
}: {
  id: MoveStatus
  title: string
  count: number
  moves: Move[]
  onComplete: (id: string) => Promise<void>
  variant: MoveVariant
  scrollable?: boolean
  onEditMove?: (move: Move) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] text-zinc-300">
          {count}
        </span>
      </div>
      <div className="mb-4 border-b border-zinc-800/60" />
      <div
        ref={setNodeRef}
        className={`min-h-[100px] rounded-2xl transition-colors ${scrollable ? "max-h-[72vh] overflow-y-auto pr-1" : ""} ${isOver ? "bg-fuchsia-500/10 ring-2 ring-fuchsia-500/30" : ""}`}
      >
        <SortableContext items={moves.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {moves.length === 0 && <div className="py-8 text-center text-sm text-zinc-600">Drop moves here</div>}
            {moves.map((move) => (
              <SortableMoveCard
                key={move.id}
                move={move}
                variant={variant}
                onComplete={onComplete}
                onClick={() => onEditMove?.(move)}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </section>
  )
}

// Sortable wrapper for MoveCard
function SortableMoveCard({
  move,
  variant,
  onComplete,
  onClick,
  isDragging = false,
}: {
  move: Move
  variant: MoveVariant
  onComplete: (id: string) => Promise<void>
  onClick?: () => void
  isDragging?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id: move.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableIsDragging ? 0.5 : 1,
    zIndex: sortableIsDragging ? 50 : "auto",
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MoveCard
        move={move}
        variant={variant}
        onComplete={onComplete}
        onClick={onClick}
        isDragging={sortableIsDragging}
      />
    </div>
  )
}

function MovesList({
  moves,
  onComplete,
  onEditMove,
}: {
  moves: Move[]
  onComplete: (id: string, previousStatus: MoveStatus) => Promise<void>
  onEditMove?: (move: Move) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>("client")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sortedMoves = useMemo(() => {
    return [...moves].sort((a, b) => {
      let cmp = 0
      if (sortKey === "client") cmp = (a.client || "").localeCompare(b.client || "")
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status)
      else if (sortKey === "type") cmp = (a.type || "").localeCompare(b.type || "")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [moves, sortKey, sortDir])

  const SortIcon = sortDir === "asc" ? ArrowUp : ArrowDown

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-900/50 text-zinc-400 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort("client")}>
              <span className="flex items-center gap-1">
                Client {sortKey === "client" && <SortIcon className="h-3 w-3" />}
              </span>
            </th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort("status")}>
              <span className="flex items-center gap-1">
                Status {sortKey === "status" && <SortIcon className="h-3 w-3" />}
              </span>
            </th>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort("type")}>
              <span className="flex items-center gap-1">
                Type {sortKey === "type" && <SortIcon className="h-3 w-3" />}
              </span>
            </th>
            <th className="px-4 py-3 w-24"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {sortedMoves.map((move) => (
            <tr key={move.id} className="hover:bg-zinc-900/30 transition">
              <td className="px-4 py-3 font-medium text-zinc-100">{move.client || "—"}</td>
              <td className="px-4 py-3 text-zinc-300">{move.title}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    move.status === "today"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : move.status === "upnext"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-zinc-700/50 text-zinc-400"
                  }`}
                >
                  {move.status === "today" ? "Today" : move.status === "upnext" ? "Up Next" : "Backlog"}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-400">{move.type}</td>
              <td className="px-4 py-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onComplete(move.id, move.status)
                  }}
                  className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-fuchsia-500 hover:text-white transition"
                >
                  Done
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FocusView({ moves, onComplete }: { moves: Move[]; onComplete: (id: string) => Promise<void> }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const activeMove = moves[currentIndex]

  if (!activeMove) {
    return (
      <div className="mt-12 flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-emerald-500/20 p-6 mb-4">
          <Check className="h-12 w-12 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100">All done for today!</h2>
        <p className="mt-2 text-zinc-400">No more moves in your Today queue.</p>
      </div>
    )
  }

  return (
    <div className="mt-8 flex flex-col items-center">
      <div className="w-full max-w-xl">
        <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            Move {currentIndex + 1} of {moves.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-300 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(moves.length - 1, i + 1))}
              disabled={currentIndex >= moves.length - 1}
              className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-300 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-8 border border-zinc-700/50">
          <div className="mb-2 text-sm font-medium text-fuchsia-400">{activeMove.client}</div>
          <h2 className="text-3xl font-bold text-zinc-100 mb-4">{activeMove.title}</h2>
          {activeMove.description && <p className="text-zinc-400 mb-6">{activeMove.description}</p>}
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-700/50 px-3 py-1 text-sm text-zinc-300">{activeMove.type}</span>
            <span className="text-sm text-zinc-500">{activeMove.ageLabel}</span>
          </div>
          <button
            onClick={async () => {
              await onComplete(activeMove.id)
              if (currentIndex >= moves.length - 1) {
                setCurrentIndex(Math.max(0, currentIndex - 1))
              }
            }}
            className="mt-8 w-full rounded-full bg-fuchsia-500 py-3 text-lg font-semibold text-white hover:bg-fuchsia-600 transition"
          >
            Complete Move
          </button>
        </div>
      </div>
    </div>
  )
}

function MoveCard({
  move,
  variant,
  onComplete,
  onClick,
  isDragging = false,
}: {
  move: Move
  variant: MoveVariant
  onComplete: (id: string) => Promise<void>
  onClick?: () => void
  isDragging?: boolean
}) {
  const isMobile = useIsMobile()
  const [completing, setCompleting] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleComplete = async () => {
    setCompleting(true)
    await onComplete(move.id)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile || isDragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: y * 8, y: -x * 8 })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
  }

  const typeIcon = {
    Quick: <Zap className="h-3 w-3" />,
    Standard: <FileText className="h-3 w-3" />,
    Chunky: <Layers className="h-3 w-3" />,
    Deep: <Clock className="h-3 w-3" />,
  }

  const isCompact = variant === "compact"

  const subtasks = move.subtasks || []
  const completedSubtasks = subtasks.filter((s) => s.completed).length
  const totalSubtasks = subtasks.length
  const hasSubtasks = totalSubtasks > 0

  return (
    <motion.div
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: isMobile || isDragging ? 0 : tilt.x,
        rotateY: isMobile || isDragging ? 0 : tilt.y,
        scale: completing ? 0.95 : isDragging ? 1.02 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      style={{ perspective: 1000 }}
      className={`group relative rounded-2xl border transition-all ${onClick ? "cursor-pointer" : "cursor-grab"} active:cursor-grabbing ${
        isDragging
          ? "border-fuchsia-500/50 bg-zinc-900 shadow-xl shadow-fuchsia-500/20"
          : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:shadow-lg"
      } ${isCompact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={`font-medium text-fuchsia-400 ${isCompact ? "text-xs" : "text-sm"}`}>{move.client}</div>
          <h3
            className={`font-semibold text-zinc-100 leading-snug break-words ${isCompact ? "text-sm mt-0.5" : "text-base mt-1"}`}
          >
            {move.title}
          </h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleComplete()
          }}
          disabled={completing}
          aria-label={`Complete task: ${move.title}`}
          title={`Complete: ${move.title}`}
          className={`flex-shrink-0 p-2 rounded-xl transition-all ${
            completing
              ? "bg-emerald-500 text-white scale-90"
              : "bg-zinc-800 text-zinc-400 hover:bg-emerald-500/20 hover:text-emerald-400"
          }`}
        >
          <Check className={`${isCompact ? "h-4 w-4" : "h-5 w-5"} ${completing ? "animate-pulse" : ""}`} />
        </button>
      </div>

      {hasSubtasks && (
        <div className={`flex items-center gap-2 ${isCompact ? "mt-2" : "mt-3"}`}>
          <CheckSquare className="h-3.5 w-3.5 text-zinc-500" />
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-fuchsia-500 transition-all duration-300"
              style={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 tabular-nums">
            {completedSubtasks}/{totalSubtasks}
          </span>
        </div>
      )}

      <div className={`flex items-center justify-between ${isCompact ? "mt-2" : "mt-3"}`}>
        {/* Type badge and age label */}
        <span className="flex items-center gap-1">
          {typeIcon[move.type]}
          {move.type}
        </span>
        <span className="text-sm text-zinc-500">{move.ageLabel}</span>
      </div>
    </motion.div>
  )
}

function UndoToast({
  undoState,
  onUndo,
}: {
  undoState: { id: string; previousStatus: MoveStatus } | null
  onUndo: () => void
}) {
  return (
    <AnimatePresence>
      {undoState && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 rounded-full bg-zinc-800 border border-zinc-700 px-4 py-2 shadow-lg">
            <span className="text-sm text-zinc-300">Move completed</span>
            <button onClick={onUndo} className="text-sm font-medium text-fuchsia-400 hover:text-fuchsia-300">
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
