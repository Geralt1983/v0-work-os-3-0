"use client"

import type React from "react"

import { useState, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, Reorder } from "framer-motion"
import { Check, Archive, LayoutGrid, List, Focus } from "lucide-react"
import { useMoves, useClients, type Move, type MoveStatus } from "@/hooks/use-moves"
import { Wand2 } from "lucide-react"
import { WorkOSNav } from "@/components/work-os-nav"
import { RewriteDialog } from "@/components/rewrite-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NewMoveDialog } from "@/components/new-move-dialog"
import { useIsMobile } from "@/hooks/use-mobile"

type MoveVariant = "primary" | "compact"
type MovesView = "board" | "list" | "focus"
type FilterValue = "all" | string
type UndoState = { id: string; title: string; previousStatus: MoveStatus } | null
type SortKey = "client" | "title" | "type" | "status"
type SortDir = "asc" | "desc"

const mobileTabs = [
  { key: "today", label: "Today" },
  { key: "upnext", label: "Next" },
  { key: "backlog", label: "Backlog" },
  { key: "done", label: "Done" },
] as const

type TabKey = (typeof mobileTabs)[number]["key"]
type ViewType = "board" | "list" | "focus"

export default function MovesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("today")
  const [view, setView] = useState<ViewType>("board")
  const [showBacklog, setShowBacklog] = useState(true)
  const [clientFilter, setClientFilter] = useState<FilterValue>("all")
  const [statusFilter, setStatusFilter] = useState<FilterValue>("all")
  const [typeFilter, setTypeFilter] = useState<FilterValue>("all")
  const [showNewMoveDialog, setShowNewMoveDialog] = useState(false)

  const {
    moves,
    isLoading: loading,
    completeMove,
    restoreMove,
    reorderMoves,
    updateMoveStatus,
    createMove,
  } = useMoves()
  const { clients } = useClients()

  const clientMap = useMemo(() => {
    const map = new Map<number, string>()
    clients.forEach((c) => map.set(c.id, c.name))
    return map
  }, [clients])

  const enrichedMoves = useMemo(() => {
    return moves.map((m) => ({
      ...m,
      client: m.clientId ? clientMap.get(m.clientId) || "Unknown" : "Unknown",
    }))
  }, [moves, clientMap])

  const clientOptions = useMemo(() => {
    const unique = Array.from(new Set(enrichedMoves.map((m) => m.client).filter((c) => c !== "Unknown")))
    return unique.sort()
  }, [enrichedMoves])

  const [undoState, setUndoState] = useState<UndoState>(null)
  const undoTimeoutRef = useRef<number | null>(null)

  const handleComplete = async (moveId: string, previousStatus: MoveStatus) => {
    const move = enrichedMoves.find((m) => m.id === moveId)
    if (!move) return
    completeMove(moveId)
    setUndoState({ id: moveId, title: move.title, previousStatus })
    if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current)
    undoTimeoutRef.current = window.setTimeout(() => setUndoState(null), 4000)
  }

  const handleUndo = () => {
    if (!undoState) return
    restoreMove(undoState.id, undoState.previousStatus)
    setUndoState(null)
    if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current)
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
          {/* Client filter - grows to fill on mobile */}
          <div className="flex-1 md:flex-none md:w-auto">
            <FilterSelect
              value={clientFilter}
              onValueChange={setClientFilter}
              options={[{ value: "all", label: "All Clients" }, ...clientOptions.map((c) => ({ value: c, label: c }))]}
              fullWidth
            />
          </div>

          {/* Backlog toggle */}
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

          {/* New Move button */}
          <button
            onClick={() => setShowNewMoveDialog(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-fuchsia-500 px-4 text-sm font-medium text-white hover:bg-fuchsia-600 transition"
          >
            <span className="hidden md:inline text-lg leading-none">+</span>
            <span>New</span>
          </button>
        </div>

        <NewMoveDialog open={showNewMoveDialog} onClose={() => setShowNewMoveDialog(false)} onSubmit={createMove} />

        <div className="mt-3 flex flex-col gap-3">
          {/* Mobile: Tab pills */}
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

          {/* Desktop: View toggle + filters */}
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
              />
            </div>
          </div>
        </div>

        {/* Mobile view */}
        <div className="lg:hidden mt-4">
          <MovesListMobile moves={byStatus[activeTab] || []} activeTab={activeTab} onComplete={handleComplete} />
        </div>

        {/* Desktop view */}
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
            />
          )}
          {view === "list" && <MovesList moves={filteredMoves} onComplete={handleComplete} />}
          {view === "focus" && <FocusView moves={byStatus.today} onComplete={handleComplete} />}
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
}: { moves: Move[]; activeTab: MoveStatus; onComplete: (id: string, previousStatus: MoveStatus) => Promise<void> }) {
  return (
    <div className="flex flex-col gap-3">
      {moves.length === 0 && <div className="text-center py-12 text-zinc-500">No moves in this category</div>}
      {moves.map((move) => (
        <MoveCard key={move.id} move={move} variant="primary" onComplete={(id) => onComplete(id, activeTab)} />
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
}: {
  value: string
  onValueChange: (v: string) => void
  options: { value: string; label: string }[]
  fullWidth?: boolean
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
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
}: {
  showBacklog: boolean
  todayMoves: Move[]
  upNextMoves: Move[]
  backlogMoves: Move[]
  doneMoves: Move[]
  onComplete: (id: string) => Promise<void>
  onReorder?: (moves: Move[]) => void
}) {
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
  const visibleColumns = showBacklog ? columns : columns.filter((c) => c.id !== "backlog")
  return (
    <div className="mt-6 w-full grid grid-cols-1 gap-10 lg:grid-cols-3">
      {visibleColumns.map((col) => {
        const columnMoves = getMovesForStatus(col.id)
        return (
          <MoveColumn
            key={col.id}
            id={col.id}
            title={col.label}
            count={columnMoves.length}
            moves={columnMoves}
            onComplete={(id) => onComplete(id)}
            onReorder={onReorder}
            variant={col.id === "backlog" ? "compact" : "primary"}
            scrollable={col.id === "backlog"}
          />
        )
      })}
    </div>
  )
}

function MoveColumn({
  id,
  title,
  count,
  moves,
  onComplete,
  onReorder,
  variant,
  scrollable,
}: {
  id: MoveStatus
  title: string
  count: number
  moves: Move[]
  onComplete: (id: string) => Promise<void>
  onReorder?: (moves: Move[]) => void
  variant: MoveVariant
  scrollable?: boolean
}) {
  const isMobile = useIsMobile()

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] text-zinc-300">
          {count}
        </span>
      </div>
      <div className="mb-4 border-b border-zinc-800/60" />
      <div id={id} className={`min-h-[100px] rounded-2xl ${scrollable ? "max-h-[72vh] overflow-y-auto pr-1" : ""}`}>
        {!isMobile && onReorder ? (
          <Reorder.Group axis="y" values={moves} onReorder={onReorder} className="flex flex-col gap-3">
            {moves.map((move) => (
              <Reorder.Item
                key={move.id}
                value={move}
                className="cursor-grab active:cursor-grabbing"
                whileDrag={{
                  scale: 1.02,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  zIndex: 50,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              >
                <MoveCard move={move} variant={variant} onComplete={onComplete} />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <div className="flex flex-col gap-3">
            {moves.map((move) => (
              <MoveCard key={move.id} move={move} variant={variant} onComplete={onComplete} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function MovesList({
  moves,
  onComplete,
}: { moves: Move[]; onComplete: (id: string, previousStatus: MoveStatus) => Promise<void> }) {
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
    const statusOrder: Record<string, number> = { today: 0, upnext: 1, backlog: 2 }
    const typeOrder: Record<string, number> = { Quick: 0, Standard: 1, Deep: 2 }
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
    <div className="mt-6">
      <div className="h-[calc(100vh-280px)] rounded-2xl border border-zinc-800/60 bg-zinc-900/40 flex flex-col overflow-hidden">
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
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${move.status === "today" ? "bg-emerald-500/20 text-emerald-300" : move.status === "upnext" ? "bg-amber-500/20 text-amber-300" : "bg-zinc-700/50 text-zinc-400"}`}
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

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: { label: string; sortKey: SortKey; active: boolean; dir: SortDir; onClick: () => void; className?: string }) {
  return (
    <th className={`px-4 py-3 font-medium ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-xs tracking-wide uppercase transition-colors ${active ? "text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}
      >
        {label}
        {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  )
}

function FocusView({
  moves,
  onComplete,
}: { moves: Move[]; onComplete: (id: string, previousStatus: MoveStatus) => Promise<void> }) {
  const move = moves.find((m) => m.status === "today") || moves.find((m) => m.status === "upnext")
  if (!move) {
    return (
      <div className="mt-6 flex items-center justify-center py-24">
        <div className="text-center">
          <Focus className="h-12 w-12 mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-500">No moves in queue</p>
          <p className="text-xs text-zinc-600 mt-1">Add a move to Today or Up Next to focus on it</p>
        </div>
      </div>
    )
  }
  return (
    <div className="mt-6 flex items-center justify-center py-12">
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
            <Check className="h-4 w-4" /> Mark Complete
          </button>
        </div>
      </div>
    </div>
  )
}

function MoveCard({
  move,
  variant = "primary",
  onComplete,
}: { move: Move; variant?: MoveVariant; onComplete: (id: string) => Promise<void> }) {
  const [isCompleting, setIsCompleting] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [rewriteOpen, setRewriteOpen] = useState(false)
  const isCompact = variant === "compact"
  const isMobile = useIsMobile()

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useTransform(y, [-100, 100], [4, -4])
  const rotateY = useTransform(x, [-100, 100], [-4, 4])
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (isMobile) return
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set(e.clientX - centerX)
    y.set(e.clientY - centerY)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
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
        transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.6 }}
        style={
          !isMobile
            ? {
                rotateX: springRotateX,
                rotateY: springRotateY,
                transformPerspective: 1000,
              }
            : undefined
        }
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={
          !isMobile
            ? {
                y: -2,
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                transition: { type: "spring", stiffness: 400, damping: 25 },
              }
            : undefined
        }
        className={`w-full relative rounded-3xl bg-zinc-900/70 border border-zinc-800/70 px-5 py-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.25)] text-zinc-100 transition-opacity duration-300 ${isCompleted ? "opacity-60" : ""}`}
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
              onClick={() => onComplete(move.id)}
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
        <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-400">
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
        context={{ client: move.client, type: move.type, timeboxMinutes: 45 }}
        onAccept={(newText) => console.log("[v0] Rewrite accepted:", newText)}
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

function UndoToast({ undoState, onUndo }: { undoState: UndoState; onUndo: () => void }) {
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
