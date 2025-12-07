"use client"
import { useState, useEffect, useRef, useMemo } from "react"
import { DashboardIcon, ListBulletIcon } from "@radix-ui/react-icons"
import { Wand2, Check, Target } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDndContext,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { WorkOSNav } from "@/components/work-os-nav"
import { useMoves } from "@/hooks/use-moves"
import type { Move, MoveStatus } from "@/lib/mock-api"
import { RewriteDialog } from "@/components/rewrite-dialog"

type MoveVariant = "primary" | "compact"

type MovesView = "board" | "list" | "focus"

type FilterValue = "all" | string

type UndoState = {
  id: string
  title: string
  previousStatus: MoveStatus
} | null

type SortKey = "client" | "title" | "type" | "status"
type SortDir = "asc" | "desc"

const tabs = [
  { key: "today", label: "Today", showCheck: true },
  { key: "upnext", label: "Up Next", showCheck: false },
  { key: "backlog", label: "Backlog", showCheck: false },
  { key: "done", label: "Done", showCheck: false },
]

const dragSpring = {
  type: "spring" as const,
  stiffness: 520,
  damping: 40,
  mass: 0.7,
}

export default function MovesPage() {
  const [showBacklog, setShowBacklog] = useState(true)
  const [activeTab, setActiveTab] = useState<MoveStatus>("today")
  const [view, setView] = useState<MovesView>("board")

  const [clientFilter, setClientFilter] = useState<FilterValue>("all")
  const [statusFilter, setStatusFilter] = useState<FilterValue>("all")
  const [typeFilter, setTypeFilter] = useState<FilterValue>("all")

  const { moves, loading, completeMove, restoreMove, reorderMoves, updateMoveStatus } = useMoves()
  const backlogCount = moves.filter((m) => m.status === "backlog").length

  const [undoState, setUndoState] = useState<UndoState>(null)
  const undoTimeoutRef = useRef<number | null>(null)

  const handleComplete = async (moveId: string, previousStatus: MoveStatus) => {
    const move = moves.find((m) => m.id === moveId)
    if (!move) return

    // Fire completion
    completeMove(moveId)

    // Set undo state
    setUndoState({ id: moveId, title: move.title, previousStatus })

    // Clear any existing timeout
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current)
    }

    // Auto-dismiss after 4 seconds
    undoTimeoutRef.current = window.setTimeout(() => {
      setUndoState(null)
    }, 4000)
  }

  const handleUndo = () => {
    if (!undoState) return

    restoreMove(undoState.id, undoState.previousStatus)
    setUndoState(null)

    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current)
    }
  }

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        window.clearTimeout(undoTimeoutRef.current)
      }
    }
  }, [])

  const handleReorder = (status: MoveStatus, orderedIds: string[]) => {
    reorderMoves(status, orderedIds)
  }

  const handleStatusChange = (moveId: string, newStatus: MoveStatus, insertAtIndex?: number) => {
    updateMoveStatus(moveId, newStatus, insertAtIndex)
  }

  const clients = useMemo(() => {
    const unique = Array.from(new Set(moves.map((m) => m.client)))
    return unique.sort()
  }, [moves])

  const filteredMoves = useMemo(() => {
    return moves.filter((m) => {
      if (clientFilter !== "all" && m.client !== clientFilter) return false
      if (statusFilter !== "all" && m.status !== statusFilter) return false
      if (typeFilter !== "all" && m.type !== typeFilter) return false
      return true
    })
  }, [moves, clientFilter, statusFilter, typeFilter])

  const byStatus = useMemo(() => {
    const today = filteredMoves.filter((m) => m.status === "today")
    const upnext = filteredMoves.filter((m) => m.status === "upnext")
    const backlog = filteredMoves.filter((m) => m.status === "backlog")
    const done = filteredMoves.filter((m) => m.status === "done")
    return { today, upnext, backlog, done }
  }, [filteredMoves])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex items-baseline gap-3 flex-1">
              <h1 className="text-2xl font-bold text-zinc-100 md:text-3xl">Moves</h1>
              <button className="flex h-9 items-center gap-1.5 rounded-full bg-fuchsia-500 px-4 text-sm font-medium text-white hover:bg-fuchsia-600 transition">
                <span className="text-lg leading-none">+</span> New Move
              </button>
            </div>
            <WorkOSNav active="moves" />
          </div>

          {/* View toggle and backlog toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ViewToggle view={view} onChange={setView} />
            </div>
            <button
              onClick={() => setShowBacklog((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              {showBacklog ? "Hide Backlog" : "Show Backlog"}
            </button>
          </div>

          {/* Filters - desktop */}
          <div className="hidden md:flex items-center gap-2">
            <FilterSelect
              label="Client"
              value={clientFilter}
              options={[{ value: "all", label: "All Clients" }, ...clients.map((c) => ({ value: c, label: c }))]}
              onChange={setClientFilter}
            />
            <FilterSelect
              label="Status"
              value={statusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "today", label: "Today" },
                { value: "upnext", label: "Up Next" },
                { value: "backlog", label: "Backlog" },
              ]}
              onChange={setStatusFilter}
            />
            <FilterSelect
              label="Type"
              value={typeFilter}
              options={[
                { value: "all", label: "All Types" },
                { value: "Quick", label: "Quick" },
                { value: "Standard", label: "Standard" },
                { value: "Deep", label: "Deep" },
              ]}
              onChange={setTypeFilter}
            />
          </div>

          {/* Filters - mobile */}
          <div className="md:hidden">
            <FilterSelect
              label="Client"
              value={clientFilter}
              options={[{ value: "all", label: "All Clients" }, ...clients.map((c) => ({ value: c, label: c }))]}
              onChange={setClientFilter}
              fullWidth
            />
          </div>
        </div>

        {/* Content */}
        {view === "board" && (
          <>
            <MovesBoard
              showBacklog={showBacklog}
              todayMoves={byStatus.today}
              upNextMoves={byStatus.upnext}
              backlogMoves={byStatus.backlog}
              doneMoves={byStatus.done}
              onComplete={handleComplete}
              onReorder={handleReorder}
              onStatusChange={handleStatusChange}
            />
            <MovesMobileBoard
              showBacklog={showBacklog}
              todayMoves={byStatus.today}
              upNextMoves={byStatus.upnext}
              backlogMoves={byStatus.backlog}
              doneMoves={byStatus.done}
              onComplete={handleComplete}
              onReorder={handleReorder}
            />
          </>
        )}

        {view === "list" && <MovesList moves={filteredMoves} onComplete={handleComplete} />}

        {view === "focus" && <FocusView moves={byStatus.today} onComplete={handleComplete} />}
      </div>

      <UndoToast undoState={undoState} onUndo={handleUndo} />
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: MovesView; onChange: (v: MovesView) => void }) {
  return (
    <div className="inline-flex rounded-full bg-zinc-900 p-1">
      <button
        onClick={() => onChange("board")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
          view === "board" ? "bg-fuchsia-500 text-white" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <DashboardIcon className="h-3.5 w-3.5" />
        Board
      </button>
      <button
        onClick={() => onChange("list")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
          view === "list" ? "bg-fuchsia-500 text-white" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <ListBulletIcon className="h-3.5 w-3.5" />
        List
      </button>
      <button
        onClick={() => onChange("focus")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
          view === "focus" ? "bg-fuchsia-500 text-white" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        <Target className="h-3.5 w-3.5" />
        Focus
      </button>
    </div>
  )
}

interface FilterSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  fullWidth?: boolean
}

function FilterSelect({ label, value, options, onChange, fullWidth }: FilterSelectProps) {
  const selected = options.find((o) => o.value === value)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// Updated MovesBoard props interface to accept insertAtIndex
interface MovesBoardProps {
  showBacklog: boolean
  todayMoves: Move[]
  upNextMoves: Move[]
  backlogMoves: Move[]
  doneMoves: Move[]
  onComplete: (id: string, previousStatus: MoveStatus) => Promise<void>
  onReorder: (status: MoveStatus, orderedIds: string[]) => void
  onStatusChange: (id: string, newStatus: MoveStatus, insertAtIndex?: number) => void
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
  onStatusChange,
}: MovesBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const allMoves = useMemo(() => {
    return [...todayMoves, ...upNextMoves, ...backlogMoves]
  }, [todayMoves, upNextMoves, backlogMoves])

  const movesMap = useMemo(() => {
    const map: Record<string, Move> = {}
    allMoves.forEach((m) => {
      map[m.id] = m
    })
    return map
  }, [allMoves])

  const getMovesForStatus = (status: MoveStatus) => {
    switch (status) {
      case "today":
        return todayMoves
      case "upnext":
        return upNextMoves
      case "backlog":
        return backlogMoves
      default:
        return []
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeMove = movesMap[activeId]
    if (!activeMove) return

    // Check if dropped on a column header
    const targetColumn = columns.find((c) => c.id === overId)
    if (targetColumn) {
      // Move to end of that column
      if (activeMove.status !== targetColumn.id) {
        onStatusChange(activeId, targetColumn.id)
      }
      return
    }

    // Dropped on another card
    const overMove = movesMap[overId]
    if (!overMove) return

    const sourceStatus = activeMove.status
    const targetStatus = overMove.status

    if (sourceStatus === targetStatus) {
      // Same column: reorder
      const columnMoves = getMovesForStatus(sourceStatus)
      const oldIndex = columnMoves.findIndex((m) => m.id === activeId)
      const newIndex = columnMoves.findIndex((m) => m.id === overId)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(
          columnMoves.map((m) => m.id),
          oldIndex,
          newIndex,
        )
        onReorder(sourceStatus, newOrder)
      }
    } else {
      // Cross-column: change status and insert at drop position
      const targetMoves = getMovesForStatus(targetStatus)
      const insertAtIndex = targetMoves.findIndex((m) => m.id === overId)
      onStatusChange(activeId, targetStatus, insertAtIndex !== -1 ? insertAtIndex : undefined)
    }
  }

  const activeMove = activeId ? movesMap[activeId] : null

  const visibleColumns = showBacklog ? columns : columns.filter((c) => c.id !== "backlog")

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="hidden lg:grid mt-6 w-full grid-cols-1 gap-10 md:grid-cols-3">
        {visibleColumns.map((col) => {
          const columnMoves = getMovesForStatus(col.id)
          return (
            <MoveColumn
              key={col.id}
              id={col.id}
              title={col.label}
              count={columnMoves.length}
              moves={columnMoves}
              onComplete={(id) => onComplete(id, col.id)}
              variant={col.id === "backlog" ? "compact" : "primary"}
              scrollable={col.id === "backlog"}
            />
          )
        })}
      </div>

      <DragOverlay>
        {activeMove && (
          <div className="opacity-90">
            <MoveCard
              variant={activeMove.status === "backlog" ? "compact" : "primary"}
              move={activeMove}
              onComplete={() => {}}
              isDragging
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

interface MoveColumnProps {
  id: MoveStatus
  title: string
  count: number
  moves: Move[]
  onComplete: (id: string) => Promise<void>
  variant: MoveVariant
  scrollable?: boolean
}

function MoveColumn({ id, title, count, moves, onComplete, variant, scrollable }: MoveColumnProps) {
  return (
    <SortableContext items={moves.map((m) => m.id)} strategy={verticalListSortingStrategy}>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] text-zinc-300">
            {count}
          </span>
        </div>
        <div className="mb-4 border-b border-zinc-800/60" />
        <div id={id} className={`min-h-[100px] rounded-2xl ${scrollable ? "max-h-[72vh] overflow-y-auto pr-1" : ""}`}>
          <div className="flex flex-col gap-3">
            {moves.map((move) => (
              <SortableMoveCard key={move.id} move={move} variant={variant} onComplete={onComplete} />
            ))}
          </div>
        </div>
      </section>
    </SortableContext>
  )
}

interface SortableMoveCardProps {
  move: Move
  variant: MoveVariant
  onComplete: (id: string) => Promise<void>
}

function SortableMoveCard({ move, variant, onComplete }: SortableMoveCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: move.id,
  })

  const { active, over } = useDndContext()
  const isActive = active?.id === move.id
  const isOverThis = over?.id === move.id
  // Show gap above this card if another card would drop here
  const showGapAbove = !isActive && isOverThis && !!active

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const effectiveVariant = isDragging ? "primary" : variant

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-[margin] duration-150 ease-out ${
        isDragging ? "opacity-50 scale-[1.02] z-10" : ""
      } ${showGapAbove ? "mt-8" : ""}`}
    >
      <MoveCard variant={effectiveVariant} move={move} onComplete={onComplete} isDragging={isDragging} />
    </div>
  )
}

interface MovesMobileBoardProps {
  showBacklog: boolean
  todayMoves: Move[]
  upNextMoves: Move[]
  backlogMoves: Move[]
  doneMoves: Move[]
  onComplete: (id: string, previousStatus: MoveStatus) => Promise<void>
  onReorder: (status: MoveStatus, orderedIds: string[]) => void
}

function MovesMobileBoard({
  showBacklog,
  todayMoves,
  upNextMoves,
  backlogMoves,
  doneMoves,
  onComplete,
  onReorder,
}: MovesMobileBoardProps) {
  const [activeTab, setActiveTab] = useState<"today" | "upnext" | "backlog">("today")
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const activeMoves = activeTab === "today" ? todayMoves : activeTab === "upnext" ? upNextMoves : backlogMoves

  const movesMap = useMemo(() => {
    const map: Record<string, Move> = {}
    activeMoves.forEach((m) => {
      map[m.id] = m
    })
    return map
  }, [activeMoves])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeIdx = activeMoves.findIndex((m) => m.id === active.id)
    const overIdx = activeMoves.findIndex((m) => m.id === over.id)

    if (activeIdx !== overIdx) {
      const newOrder = arrayMove(
        activeMoves.map((m) => m.id),
        activeIdx,
        overIdx,
      )
      onReorder(activeTab, newOrder)
    }
  }

  const activeMove = activeId ? movesMap[activeId] : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="lg:hidden mt-6">
        {/* Tab buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("today")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === "today" ? "bg-fuchsia-500 text-white" : "bg-zinc-900 text-zinc-400"
            }`}
          >
            Today ({todayMoves.length})
          </button>
          <button
            onClick={() => setActiveTab("upnext")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === "upnext" ? "bg-fuchsia-500 text-white" : "bg-zinc-900 text-zinc-400"
            }`}
          >
            Up Next ({upNextMoves.length})
          </button>
          {showBacklog && (
            <button
              onClick={() => setActiveTab("backlog")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "backlog" ? "bg-fuchsia-500 text-white" : "bg-zinc-900 text-zinc-400"
              }`}
            >
              Backlog ({backlogMoves.length})
            </button>
          )}
        </div>

        <SortableContext items={activeMoves.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {activeMoves.map((move) => (
              <SortableMoveCard
                key={move.id}
                move={move}
                variant={activeTab === "backlog" ? "compact" : "primary"}
                onComplete={(id) => onComplete(id, activeTab)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeMove && (
            <div className="opacity-90">
              <MoveCard
                variant={activeTab === "backlog" ? "compact" : "primary"}
                move={activeMove}
                onComplete={() => {}}
                isDragging
              />
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

interface MovesListProps {
  moves: Move[]
  onComplete: (id: string, previousStatus: MoveStatus) => Promise<void>
}

function MovesList({ moves, onComplete }: MovesListProps) {
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

  const sorted = useMemo(() => {
    const copy = [...moves]

    const statusOrder: Record<string, number> = {
      today: 0,
      upnext: 1,
      backlog: 2,
    }

    const typeOrder: Record<string, number> = {
      Quick: 0,
      Standard: 1,
      Deep: 2,
    }

    copy.sort((a, b) => {
      let aVal: string | number = sortKey === "title" ? a.title : a[sortKey]
      let bVal: string | number = sortKey === "title" ? b.title : b[sortKey]

      if (sortKey === "status") {
        aVal = statusOrder[a.status] ?? 99
        bVal = statusOrder[b.status] ?? 99
      } else if (sortKey === "type") {
        aVal = typeOrder[a.type] ?? 99
        bVal = typeOrder[b.type] ?? 99
      }

      let cmp: number
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal)
      } else {
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      }

      return sortDir === "asc" ? cmp : -cmp
    })

    return copy
  }, [moves, sortKey, sortDir])

  return (
    <div className="hidden lg:block mt-6">
      <div className="h-[calc(100vh-280px)] rounded-2xl border border-zinc-800/60 bg-zinc-900/40 flex flex-col overflow-hidden">
        {/* Pinned table header */}
        <div className="flex-none">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/60 text-xs text-zinc-500 uppercase tracking-wide bg-zinc-900/60">
                <SortableHeader
                  label="Client"
                  sortKey="client"
                  active={sortKey === "client"}
                  dir={sortDir}
                  onClick={() => handleSort("client")}
                  className="w-[15%]"
                />
                <SortableHeader
                  label="Move"
                  sortKey="title"
                  active={sortKey === "title"}
                  dir={sortDir}
                  onClick={() => handleSort("title")}
                  className="w-[45%]"
                />
                <SortableHeader
                  label="Type"
                  sortKey="type"
                  active={sortKey === "type"}
                  dir={sortDir}
                  onClick={() => handleSort("type")}
                  className="w-[12%]"
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  active={sortKey === "status"}
                  dir={sortDir}
                  onClick={() => handleSort("status")}
                  className="w-[15%]"
                />
                <th className="px-4 py-3 font-medium text-right w-[13%]">Actions</th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {sorted.map((move) => (
                <tr key={move.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 w-[15%]">
                    <span className="text-xs font-medium text-zinc-400 uppercase">{move.client}</span>
                  </td>
                  <td className="px-4 py-3 w-[45%]">
                    <span className="text-zinc-100 font-medium">{move.title}</span>
                  </td>
                  <td className="px-4 py-3 w-[12%]">
                    <span className="inline-flex items-center gap-1">
                      <TypeDot type={move.type} />
                      {move.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-[15%]">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
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
                  <td className="px-4 py-3 text-right w-[13%]">
                    <button
                      type="button"
                      onClick={() => onComplete(move.id, move.status)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {moves.length === 0 && <div className="py-12 text-center text-zinc-500">No moves to display</div>}
        </div>
      </div>
    </div>
  )
}

interface SortableHeaderProps {
  label: string
  sortKey: SortKey
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}

function SortableHeader({ label, active, dir, onClick, className }: SortableHeaderProps) {
  return (
    <th className={`px-4 py-3 font-medium ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-xs tracking-wide uppercase transition-colors ${
          active ? "text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {label}
        {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  )
}

interface MovesFocusProps {
  moves: Move[] // Changed to accept array of moves
  onComplete: (id: string, previousStatus: MoveStatus) => Promise<void>
}

function FocusView({ moves, onComplete }: MovesFocusProps) {
  // Prioritize 'today', then 'upnext'
  const move = moves.find((m) => m.status === "today") || moves.find((m) => m.status === "upnext")

  if (!move) {
    return (
      <div className="hidden lg:flex mt-6 items-center justify-center py-24">
        <div className="text-center">
          <Target className="h-12 w-12 mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-500">No moves in queue</p>
          <p className="text-xs text-zinc-600 mt-1">Add a move to Today or Up Next to focus on it</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hidden lg:flex mt-6 items-center justify-center py-12">
      <div className="max-w-lg w-full">
        <div className="rounded-3xl border border-zinc-800/60 bg-zinc-900/60 p-8 text-center">
          <span className="inline-flex items-center rounded-md bg-zinc-800/60 px-3 py-1 text-xs font-semibold tracking-wide text-zinc-400 uppercase mb-4">
            {move.client}
          </span>

          <h2 className="text-2xl font-bold text-white mb-2">{move.title}</h2>

          <div className="flex items-center justify-center gap-4 text-sm text-zinc-400 mb-8">
            <span className="inline-flex items-center gap-1.5">
              <TypeDot type={move.type} />
              {move.type}
            </span>
            {move.ageLabel && <span>{move.ageLabel}</span>}
          </div>

          <button
            type="button"
            onClick={() => onComplete(move.id, move.status)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/25"
          >
            <Check className="h-4 w-4" />
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  )
}

interface DraggableMoveCardProps {
  move: Move
  variant: MoveVariant
  onComplete: (id: string) => Promise<void>
  isDragging?: boolean
}

function DraggableMoveCard({ move, variant, onComplete, isDragging }: DraggableMoveCardProps) {
  const dragSpring = { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.8 }

  return (
    <motion.div
      layout
      layoutId={move.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="cursor-grab active:cursor-grabbing"
    >
      <MoveCard variant={variant} move={move} onComplete={onComplete} isDragging={isDragging} />
    </motion.div>
  )
}

function MoveCard({
  variant,
  move,
  onComplete,
  isDragging,
}: { variant: MoveVariant; move: Move; onComplete: (id: string) => Promise<void>; isDragging?: boolean }) {
  const isCompact = variant === "compact"
  const [justCompleted, setJustCompleted] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [rewriteOpen, setRewriteOpen] = useState(false)

  const playSound = () => {
    try {
      const AudioContext =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext

      if (!AudioContext) return

      const ctx = new AudioContext()

      if (ctx.state === "suspended") {
        ctx.resume()
      }

      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.connect(gain)
      gain.connect(ctx.destination)

      oscillator.frequency.setValueAtTime(220, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.06)
      oscillator.type = "sine"

      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.08)

      setTimeout(() => ctx.close(), 120)
    } catch {
      // Silently fail
    }
  }

  const handleCompleteClick = async () => {
    if (isCompleting || justCompleted) return
    setIsCompleting(true)
    setJustCompleted(true)
    playSound()

    await new Promise((resolve) => setTimeout(resolve, 220))

    try {
      await onComplete(move.id)
    } finally {
      setIsCompleting(false)
      setJustCompleted(false)
      setIsCompleted(true)
    }
  }

  const handleRewriteAccept = (newText: string) => {
    console.log("[v0] Rewrite accepted:", newText)
  }

  if (isCompact) {
    return (
      <button className="w-full rounded-xl border border-zinc-800/50 bg-zinc-900/50 px-3 py-2 flex items-center gap-2 text-left hover:bg-zinc-800/50 hover:border-zinc-700/60 active:scale-[0.98] transition-all">
        <TypeDot type={move.type} />
        <span className="truncate text-[13px] text-zinc-200">{move.title}</span>
      </button>
    )
  }

  return (
    <>
      <motion.article
        layout
        animate={justCompleted ? { scale: 0.97, y: -2 } : { scale: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 26,
          mass: 0.6,
        }}
        className={`relative rounded-3xl bg-zinc-900/70 border border-zinc-800/70 px-5 py-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-zinc-100 transition-opacity duration-300 ${
          isCompleted ? "opacity-60" : ""
        } ${isDragging ? "opacity-50" : ""}`}
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <ClientPill client={move.client} />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRewriteOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-700/50 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition"
            >
              <Wand2 className="h-2.5 w-2.5" />
              <span>Rewrite</span>
            </button>

            <motion.button
              type="button"
              onClick={handleCompleteClick}
              whileTap={{ scale: 0.8, rotate: -8 }}
              whileHover={{ scale: 1.06 }}
              animate={justCompleted ? { scale: 1.15 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20, mass: 0.5 }}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 transition-colors"
            >
              <motion.span
                className="flex h-4 w-4 items-center justify-center"
                animate={justCompleted ? { scale: 1.2 } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 24 }}
              >
                <Check className="h-3.5 w-3.5" />
              </motion.span>

              {justCompleted && (
                <motion.span
                  key="ring-1"
                  className="pointer-events-none absolute inset-0 rounded-full border border-emerald-400/80"
                  initial={{ scale: 0.9, opacity: 0.9 }}
                  animate={{ scale: 1.9, opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              )}

              {justCompleted && (
                <motion.span
                  key="ring-2"
                  className="pointer-events-none absolute inset-0 rounded-full border border-emerald-300/60"
                  initial={{ scale: 0.9, opacity: 0.7 }}
                  animate={{ scale: 2.4, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.07 }}
                />
              )}

              <span className="sr-only">Complete move</span>
            </motion.button>
          </div>
        </div>

        <h3 className="text-[14px] font-semibold leading-snug mb-1.5">{move.title}</h3>

        <div className="flex items-center gap-4 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <TypeDot type={move.type} />
            <span>{move.type}</span>
          </span>
          {move.movesCount !== undefined && (
            <span>{move.movesCount === 1 ? "1 move" : `${move.movesCount} moves`}</span>
          )}
          {move.ageLabel && <span>{move.ageLabel}</span>}
        </div>
      </motion.article>

      <RewriteDialog
        open={rewriteOpen}
        onOpenChange={setRewriteOpen}
        originalText={move.title}
        context={{
          client: move.client,
          type: move.type,
          timeboxMinutes: 45, // Default timebox, could be configurable per move
        }}
        onAccept={handleRewriteAccept}
      />
    </>
  )
}

function ClientPill({ client }: { client: string }) {
  return (
    <div className="inline-flex items-center rounded-md bg-zinc-800/40 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
      {client}
    </div>
  )
}

function TypeDot({ type }: { type: Move["type"] }) {
  const color = type === "Quick" ? "bg-emerald-400" : type === "Chunky" ? "bg-amber-400" : "bg-cyan-400"

  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
}

type UndoToastProps = {
  undoState: UndoState
  onUndo: () => void
}

function UndoToast({ undoState, onUndo }: UndoToastProps) {
  return (
    <AnimatePresence>
      {undoState && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="pointer-events-auto fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
        >
          <div className="flex items-center gap-3 rounded-full bg-zinc-900/95 px-4 py-2.5 shadow-lg shadow-black/60 border border-zinc-800">
            <span className="text-xs text-zinc-300 truncate max-w-[180px] sm:max-w-xs">Task completed</span>
            <button
              type="button"
              onClick={onUndo}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 active:text-emerald-500"
            >
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
