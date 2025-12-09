"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { useMoves, useClients, type Move } from "@/hooks/use-moves"
import { NewMoveDialog } from "@/components/new-move-dialog"
import { EditMoveDialog } from "@/components/edit-move-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, LayoutGrid, List, GripVertical, Clock, Zap, Check, Crosshair, EyeOff, Eye } from "lucide-react"
import { WorkOSNav } from "@/components/work-os-nav"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { SynapsePicks } from "@/components/synapse-picks"
import { Graveyard } from "@/components/graveyard"
import { GroupedBacklog } from "@/components/grouped-backlog"
import { FileText, Layers, CheckSquare } from "lucide-react"
import { motion } from "framer-motion"
import { AnimatePresence } from "framer-motion"
import { DoneToday } from "@/components/done-today"

type MoveVariant = "primary" | "compact"
type MovesView = "board" | "list" | "focus"
type SortKey = "client" | "status" | "type"
type SortDir = "asc" | "desc"
type MoveStatus = "today" | "upnext" | "backlog" | "done"

export default function MovesPage() {
  const { moves, isLoading, completeMove, updateMoveStatus, reorderMoves, createMove, updateMove, updateSubtasks, setSubtasksFromTitles, refresh } = useMoves()
  const { clients } = useClients()

  const [view, setView] = useState<MovesView>("board")
  const [clientFilter, setClientFilter] = useState("all")
  const [showBacklog, setShowBacklog] = useState(true)
  const clientOptions = useMemo(() => {
    const names = new Set(moves.map((m) => m.client).filter(Boolean))
    return Array.from(names).sort() as string[]
  }, [moves])

  const [statusFilter, setStatusFilter] = useState("all")
  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "today", label: "Today" },
    { value: "upnext", label: "Queued" },
  ]

  const [typeFilter, setTypeFilter] = useState("all")
  const typeOptions = [
    { value: "all", label: "All Types" },
    { value: "deep", label: "Deep" },
    { value: "shallow", label: "Shallow" },
    { value: "admin", label: "Admin" },
  ]

  const [editingMove, setEditingMove] = useState<Move | null>(null)
  const [isNewMoveOpen, setIsNewMoveOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const isMobile = useIsMobile()

  const filteredMoves = useMemo(() => {
    return moves.filter((m) => {
      if (clientFilter !== "all" && m.client !== clientFilter) return false
      if (statusFilter !== "all" && m.status !== statusFilter) return false
      if (typeFilter !== "all" && m.drainType !== typeFilter) return false
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

  const activeMoves = useMemo(() => {
    return [...byStatus.today, ...byStatus.upnext]
  }, [byStatus.today, byStatus.upnext])

  const handleComplete = async (id: string) => {
    await completeMove(id)
    refresh()
  }

  const mobileTabs = [
    { key: "today", label: "Today", count: byStatus.today.length },
    { key: "upnext", label: "Queued", count: byStatus.upnext.length },
  ] as const

  const [activeTab, setActiveTab] = useState<"today" | "upnext">("today")

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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[140px] bg-zinc-900 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                All Clients
              </SelectItem>
              {clientOptions.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBacklog(!showBacklog)}
            className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 h-9"
          >
            {showBacklog ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showBacklog ? "Hide Backlog" : "Show Backlog"}
          </Button>

          <Button
            size="sm"
            className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white h-9 px-3"
            onClick={() => setIsNewMoveOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        <div className="mt-4">
          <DoneToday />
        </div>

        <div className="mt-4 hidden lg:block">
          <SynapsePicks />
        </div>

        <div className="hidden lg:flex items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-1 bg-zinc-900 rounded-full p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("board")}
              className={`rounded-full px-3 h-8 ${
                view === "board"
                  ? "bg-fuchsia-600 text-white hover:bg-fuchsia-600"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Board
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("list")}
              className={`rounded-full px-3 h-8 ${
                view === "list"
                  ? "bg-fuchsia-600 text-white hover:bg-fuchsia-600"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <List className="h-4 w-4 mr-1.5" />
              List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("focus")}
              className={`rounded-full px-3 h-8 ${
                view === "focus"
                  ? "bg-fuchsia-600 text-white hover:bg-fuchsia-600"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <Crosshair className="h-4 w-4 mr-1.5" />
              Focus
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-zinc-900 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {statusOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px] bg-zinc-900 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {typeOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="lg:hidden mt-4 flex items-center gap-2 border-b border-zinc-800">
          {mobileTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab.key
                  ? "border-fuchsia-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
              <Badge variant="secondary" className="text-xs">
                {tab.count}
              </Badge>
            </button>
          ))}
        </div>

        <div className="hidden lg:block mt-6">
          {view === "board" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-1">
                <h2 className="text-xl font-bold text-zinc-100">Today</h2>
                {byStatus.today.map((move) => (
                  <MoveCard
                    key={move.id}
                    move={move}
                    variant="primary"
                    onComplete={handleComplete}
                    onEdit={() => setEditingMove(move)}
                  />
                ))}
              </div>
              <div className="col-span-1">
                <h2 className="text-xl font-bold text-zinc-100">Queued</h2>
                {byStatus.upnext.map((move) => (
                  <MoveCard
                    key={move.id}
                    move={move}
                    variant="primary"
                    onComplete={handleComplete}
                    onEdit={() => setEditingMove(move)}
                  />
                ))}
              </div>
              <div className="col-span-1">
                <h2 className="text-xl font-bold text-zinc-100">Backlog</h2>
                {showBacklog && (
                  <GroupedBacklog
                    onEditMove={(taskId) => {
                      const move = moves.find((m) => m.id === taskId.toString())
                      if (move) setEditingMove(move)
                    }}
                  />
                )}
              </div>
            </div>
          )}
          {view === "list" && (
            <div className="flex flex-col gap-4">
              {filteredMoves.map((move) => (
                <MoveCard
                  key={move.id}
                  move={move}
                  variant="compact"
                  onComplete={handleComplete}
                  onEdit={() => setEditingMove(move)}
                />
              ))}
            </div>
          )}
          {view === "focus" && (
            <div className="flex flex-col gap-4">
              {activeMoves.map((move, index) => (
                <MoveCard
                  key={move.id}
                  move={move}
                  variant="primary"
                  onComplete={handleComplete}
                  onEdit={() => setEditingMove(move)}
                  isDragging={focusIndex === index}
                  onClick={() => setFocusIndex(index)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="lg:hidden mt-4">
          <div className="flex flex-col gap-4">
            {activeTab === "today" &&
              byStatus.today.map((move) => (
                <MoveCard
                  key={move.id}
                  move={move}
                  variant="compact"
                  onComplete={handleComplete}
                  onEdit={() => setEditingMove(move)}
                />
              ))}
            {activeTab === "upnext" &&
              byStatus.upnext.map((move) => (
                <MoveCard
                  key={move.id}
                  move={move}
                  variant="compact"
                  onComplete={handleComplete}
                  onEdit={() => setEditingMove(move)}
                />
              ))}
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-zinc-800/50">
          <Graveyard />
        </div>
      </div>

      <NewMoveDialog
        open={isNewMoveOpen}
        onClose={() => setIsNewMoveOpen(false)}
        onSubmit={async (data) => {
          await createMove(data)
          refresh()
        }}
      />

      <EditMoveDialog
        open={!!editingMove}
        move={editingMove}
        onClose={() => setEditingMove(null)}
        onSave={async (id, data) => {
          await updateMove(id, data)
          refresh()
        }}
        onUpdateSubtasks={async (id, subtasks) => {
          await updateSubtasks(id, subtasks)
          refresh()
        }}
        onSetSubtasksFromTitles={async (id, titles) => {
          await setSubtasksFromTitles(id, titles)
          refresh()
        }}
      />
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
        <Crosshair className="h-3.5 w-3.5" /> Focus
      </button>
    </div>
  )
}

function MoveCard({
  move,
  variant,
  onComplete,
  onClick,
  onEdit,
  isDragging = false,
}: {
  move: Move
  variant: MoveVariant
  onComplete: (id: string) => Promise<void>
  onClick?: () => void
  onEdit?: () => void
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
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="flex-shrink-0 p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
            >
              <GripVertical className={`${isCompact ? "h-4 w-4" : "h-5 w-5"}`} />
            </button>
          )}
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
