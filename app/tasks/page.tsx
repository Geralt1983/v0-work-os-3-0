"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { useTasks, useClients, type Task } from "@/hooks/use-tasks"
import { NewTaskDialog } from "@/components/new-task-dialog"
import { EditTaskDialog } from "@/components/edit-task-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, LayoutGrid, List, GripVertical, Clock, Zap, Check, Crosshair, Inbox, CheckCircle2 } from "lucide-react"
import { DailyProgressBar } from "@/components/daily-progress-bar"
import { getTaskPoints, getValueTierConfig, type ValueTier } from "@/lib/domain/task-types"
import { WorkOSNav } from "@/components/work-os-nav"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { SynapsePicks } from "@/components/synapse-picks"
import { Graveyard } from "@/components/graveyard"
import { GroupedBacklog } from "@/components/grouped-backlog"
import { QuickCapture } from "@/components/quick-capture"
import { CheckSquare } from "lucide-react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { DoneToday } from "@/components/done-today"

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useSWRConfig } from "swr"

type TaskVariant = "primary" | "compact" | "secondary"
type TasksView = "board" | "list" | "focus"
type SortKey = "client" | "status" | "type"
type SortDir = "asc" | "desc"
type TaskStatus = "today" | "upnext" | "backlog" | "done"

export default function MovesPage() {
  const {
    tasks,
    isLoading,
    completeTask,
    updateTaskStatus,
    reorderTasks,
    createTask,
    updateTask,
    updateSubtasks,
    setSubtasksFromTitles,
    deleteTask,
    refresh,
  } = useTasks()
  const { clients } = useClients()
  const { mutate: globalMutate } = useSWRConfig()
  const shouldReduceMotion = useReducedMotion()
  const baseEase: [number, number, number, number] = [0.16, 1, 0.3, 1]
  const sectionVariants = {
    hidden: { opacity: 0, y: 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduceMotion ? 0 : 0.35, ease: baseEase },
    },
  }
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
        delayChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: shouldReduceMotion ? 0 : 0.3, ease: baseEase },
    },
  }

  const [view, setView] = useState<TasksView>("board")
  const [clientFilter, setClientFilter] = useState("all")
  const clientOptions = useMemo(() => {
    const names = new Set(tasks.map((t) => t.client).filter(Boolean))
    return Array.from(names).sort() as string[]
  }, [tasks])

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

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const isMobile = useIsMobile()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedItems, setDraggedItems] = useState<{
    today: Task[]
    upnext: Task[]
  } | null>(null)
  const [recentlyDropped, setRecentlyDropped] = useState<string | null>(null)

  // DND sensors
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

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setDraggedItems({
      today: tasks.filter((t) => t.status === "today"),
      upnext: tasks.filter((t) => t.status === "upnext"),
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    const finalItems = draggedItems
    setDraggedItems(null)

    if (!over || !finalItems) return

    const activeId = active.id as string
    const overId = over.id as string

    const draggedTask = tasks.find((t) => t.id === activeId)
    if (!draggedTask) return

    // Determine the target column/status from the overId
    let targetStatus: TaskStatus | null = null
    let targetIndex = 0

    // Check if dropped over a column
    if (overId === "today-column") {
      targetStatus = "today"
      targetIndex = finalItems.today.length
    } else if (overId === "upnext-column") {
      targetStatus = "upnext"
      targetIndex = finalItems.upnext.length
    } else if (overId === "backlog-column") {
      targetStatus = "backlog"
      targetIndex = 0
    } else {
      // Dropped over another card - find its status and index in the dragged state
      const overMoveInToday = finalItems.today.find((m) => m.id === overId)
      const overMoveInUpnext = finalItems.upnext.find((m) => m.id === overId)

      if (overMoveInToday) {
        targetStatus = "today"
        targetIndex = finalItems.today.findIndex((m) => m.id === overId)
      } else if (overMoveInUpnext) {
        targetStatus = "upnext"
        targetIndex = finalItems.upnext.findIndex((m) => m.id === overId)
      }
    }

    if (!targetStatus) return

    if (targetStatus === "backlog") {
      await updateTaskStatus(activeId, "backlog")
      // Refresh the grouped backlog view
      globalMutate("/api/backlog/grouped")
      setRecentlyDropped(activeId)
      setTimeout(() => setRecentlyDropped(null), 400)
      return
    }

    // Get the final order from draggedItems for the target column
    const targetColumnItems = targetStatus === "today" ? finalItems.today : finalItems.upnext
    const newOrder = targetColumnItems.map((t) => t.id)

    // If moving to a different column, update status first then reorder
    if (draggedTask.status !== targetStatus) {
      // Update status AND provide the full new order for the target column
      await updateTaskStatus(activeId, targetStatus, targetIndex)
      // Wait a bit for the status update to propagate, then reorder
      await reorderTasks(targetStatus, newOrder)
    } else {
      // Same column - just reorder
      await reorderTasks(targetStatus, newOrder)
    }

    setRecentlyDropped(activeId)
    setTimeout(() => {
      setRecentlyDropped(null)
    }, 400)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || !draggedItems) return

    const activeId = active.id as string
    const overId = over.id as string

    if (overId === "backlog-column") return

    // Find which column the active item is currently in (in draggedItems state)
    const activeInToday = draggedItems.today.some((m) => m.id === activeId)
    const activeInUpnext = draggedItems.upnext.some((m) => m.id === activeId)
    const activeColumn = activeInToday ? "today" : activeInUpnext ? "upnext" : null

    if (!activeColumn) return

    // Find the active task
    const draggedItem = draggedItems[activeColumn].find((t) => t.id === activeId)
    if (!draggedItem) return

    // Determine target column
    let targetColumn: "today" | "upnext" | null = null

    if (overId === "today-column") {
      targetColumn = "today"
    } else if (overId === "upnext-column") {
      targetColumn = "upnext"
    } else {
      // Over a card - find which column it's in
      if (draggedItems.today.some((m) => m.id === overId)) {
        targetColumn = "today"
      } else if (draggedItems.upnext.some((m) => m.id === overId)) {
        targetColumn = "upnext"
      }
    }

    if (!targetColumn) return

    // If moving within the same column - use insert logic
    if (activeColumn === targetColumn) {
      const items = [...draggedItems[targetColumn]]
      const activeIndex = items.findIndex((t) => t.id === activeId)
      const overIndex = overId.endsWith("-column") ? items.length - 1 : items.findIndex((t) => t.id === overId)

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        // Remove from old position
        items.splice(activeIndex, 1)
        // Insert at new position
        items.splice(overIndex, 0, draggedItem)

        setDraggedItems({
          ...draggedItems,
          [targetColumn]: items,
        })
      }
    } else {
      // Moving between columns - remove from source, insert in target
      const sourceItems = draggedItems[activeColumn].filter((t) => t.id !== activeId)
      const targetItems = [...draggedItems[targetColumn]]

      // Find insertion index
      const overIndex = overId.endsWith("-column") ? targetItems.length : targetItems.findIndex((t) => t.id === overId)

      // Insert at the target position
      if (overIndex === -1) {
        targetItems.push(draggedItem)
      } else {
        targetItems.splice(overIndex, 0, draggedItem)
      }

      setDraggedItems({
        ...draggedItems,
        [activeColumn]: sourceItems,
        [targetColumn]: targetItems,
      })
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (clientFilter !== "all" && t.client !== clientFilter) return false
      if (statusFilter !== "all" && t.status !== statusFilter) return false
      if (typeFilter !== "all" && t.drainType !== typeFilter) return false
      return true
    })
  }, [tasks, clientFilter, statusFilter, typeFilter])

  const byStatus = useMemo(() => {
    const today = filteredTasks.filter((t) => t.status === "today")
    const upnext = filteredTasks.filter((t) => t.status === "upnext")
    const backlog = filteredTasks.filter((t) => t.status === "backlog")
    const done = filteredTasks.filter((t) => t.status === "done")
    return { today, upnext, backlog, done }
  }, [filteredTasks])

  const activeTasks = useMemo(() => {
    return [...byStatus.today, ...byStatus.upnext]
  }, [byStatus.today, byStatus.upnext])

  const todayPoints = useMemo(() => {
    return byStatus.today.reduce((sum, task) => sum + getTaskPoints(task), 0)
  }, [byStatus.today])

  const { doneTodayCount, doneTodayPoints } = useMemo(() => {
    const today = new Date().toDateString()
    let count = 0
    let points = 0
    tasks.forEach((task) => {
      if (task.status !== "done" || !task.completedAt) return
      if (new Date(task.completedAt).toDateString() !== today) return
      count += 1
      points += getTaskPoints(task)
    })
    return { doneTodayCount: count, doneTodayPoints: points }
  }, [tasks])

  const statCards = [
    {
      label: "Today",
      value: byStatus.today.length,
      meta: `${todayPoints} pts queued`,
      tone: "text-[color:var(--thanos-amethyst)]",
      chip: "bg-[color:var(--thanos-amethyst)]/15 border border-[color:var(--thanos-amethyst)]/35 text-[color:var(--thanos-amethyst)]",
      icon: Zap,
    },
    {
      label: "Queued",
      value: byStatus.upnext.length,
      meta: "Next to execute",
      tone: "text-[color:var(--thanos-cosmic)]",
      chip: "bg-[color:var(--thanos-cosmic)]/12 border border-[color:var(--thanos-cosmic)]/35 text-[color:var(--thanos-cosmic)]",
      icon: Clock,
    },
    {
      label: "Backlog",
      value: byStatus.backlog.length,
      meta: "Unscoped work",
      tone: "text-[color:var(--thanos-gold)]",
      chip: "bg-[color:var(--thanos-gold)]/12 border border-[color:var(--thanos-gold)]/35 text-[color:var(--thanos-gold)]",
      icon: Inbox,
    },
    {
      label: "Done Today",
      value: doneTodayCount,
      meta: `${doneTodayPoints} pts banked`,
      tone: "text-emerald-300",
      chip: "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300",
      icon: CheckCircle2,
    },
  ]

  const handleComplete = async (id: string) => {
    await completeTask(id)
    refresh()
  }

  const handleEditFromBacklog = (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId.toString())
    if (task) setEditingTask(task)
  }

  const mobileTabs = [
    { key: "today", label: "Today", count: byStatus.today.length },
    { key: "upnext", label: "Queued", count: byStatus.upnext.length },
    { key: "backlog", label: "Backlog", count: byStatus.backlog.length },
  ] as const

  const [activeTab, setActiveTab] = useState<"today" | "upnext" | "backlog">("today")

  const displayItems = draggedItems || byStatus

  function BacklogDropZone({ children, count }: { children: React.ReactNode; count: number }) {
    const { setNodeRef, isOver, active } = useDroppable({
      id: "backlog-column",
      data: { type: "column", status: "backlog" },
    })

    // Show drop target when any drag is active
    const showDropTarget = !!active

    return (
      <motion.div
        ref={setNodeRef}
        variants={itemVariants}
        className={`col-span-1 panel-obsidian rounded-xl border border-white/10 p-4 transition-all duration-200 relative ${isOver
          ? "ring-2 ring-[color:var(--thanos-amethyst)]/40 scale-[1.01]"
          : showDropTarget
            ? "ring-1 ring-dashed ring-white/20"
            : ""
          }`}
      >
        {showDropTarget && (
          <div
            className={`absolute inset-0 z-10 rounded-xl transition-colors pointer-events-none ${isOver ? "bg-[color:var(--thanos-amethyst)]/10" : "bg-transparent"
              }`}
          />
        )}
        <div className="flex items-center justify-between mb-3 relative z-20">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50">
            <Inbox className="h-4 w-4 text-[color:var(--thanos-gold)]" />
            Backlog
          </div>
          <span className="text-xs text-white/40 font-mono tabular-nums">{count}</span>
        </div>
        <div className="relative z-0">{children}</div>
        {showDropTarget && (
          <div
            className={`h-16 rounded-lg mt-3 flex items-center justify-center transition-colors ${isOver
              ? "bg-[color:var(--thanos-amethyst)]/20 border-2 border-dashed border-[color:var(--thanos-amethyst)]/50"
              : "bg-zinc-800/30 border-2 border-dashed border-zinc-700"
              }`}
          >
            <span className={`text-sm ${isOver ? "text-[color:var(--thanos-amethyst)]" : "text-zinc-500"}`}>
              {isOver ? "Release to move to backlog" : "Drop here to send to backlog"}
            </span>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen text-white noise-overlay">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:py-10"
      >
        <motion.div variants={sectionVariants} className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[color:var(--thanos-gold)]/80">
              <span className="h-2 w-2 rounded-full bg-[color:var(--thanos-gold)] shadow-[0_0_12px_rgba(234,179,8,0.6)]" />
              ThanosOS
            </div>
            <h1 className="text-2xl font-display text-gradient-brand sm:text-3xl md:text-4xl tracking-[0.12em]">
              ThanosOS Command Deck
            </h1>
            <p className="text-sm text-white/60">One task per client. Zero drift.</p>
          </div>
          <div className="flex items-center gap-3">
            <WorkOSNav />
          </div>
        </motion.div>

        <motion.div variants={sectionVariants} className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className="panel-obsidian rounded-xl border border-white/10 px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-white/50">{stat.label}</p>
                  <p className={`mt-1 text-3xl font-semibold font-mono tabular-nums ${stat.tone}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-white/40">{stat.meta}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stat.chip}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        <motion.div variants={sectionVariants} className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="panel-obsidian rounded-xl border border-white/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Quick Capture</p>
                  <p className="text-xs text-white/40 mt-1">Enter to estimate. Shift+Enter for new line.</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--thanos-amethyst)]/70">
                  AI Assist
                </span>
              </div>
              <QuickCapture onTaskCreated={refresh} />
            </div>
            <div className="hidden lg:block">
              <SynapsePicks />
            </div>
          </div>
          <div className="space-y-4">
            <DailyProgressBar className="border-white/10" />
            <DoneToday />
          </div>
        </motion.div>

        <motion.div variants={sectionVariants} className="mt-8 flex flex-wrap items-center gap-3">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[170px] panel-obsidian border-white/10 text-zinc-100 rounded-lg">
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] panel-obsidian border-white/10 text-zinc-100 rounded-lg">
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
            <SelectTrigger className="w-[150px] panel-obsidian border-white/10 text-zinc-100 rounded-lg">
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
        </motion.div>

        <motion.div variants={sectionVariants} className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-white/40">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50">
              <span className="h-2 w-2 rounded-full bg-[color:var(--thanos-amethyst)]/80 shadow-[0_0_12px_rgba(168,85,247,0.35)]" />
              Task Board
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span>{byStatus.today.length} Today</span>
              <span className="text-white/20">•</span>
              <span>{byStatus.upnext.length} Queued</span>
              <span className="text-white/20">•</span>
              <span>{byStatus.backlog.length} Backlog</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <ViewToggle view={view} onChange={setView} />
            </div>
            <Button
              size="sm"
              className="rounded-lg bg-[color:var(--thanos-amethyst)] text-white hover:bg-[color:var(--thanos-amethyst)]/90 shadow-[0_0_18px_rgba(168,85,247,0.25)] focus-visible:ring-2 focus-visible:ring-[color:var(--thanos-amethyst)]/60 btn-press"
              onClick={() => setIsNewTaskOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>
        </motion.div>

        <div className="lg:hidden mt-4 flex items-center gap-2 border-b border-white/10">
          {mobileTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition ${activeTab === tab.key
                ? "border-[color:var(--thanos-amethyst)] text-white"
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

        <motion.div variants={sectionVariants} className="hidden lg:block mt-6">
          <AnimatePresence mode="wait">
            {view === "board" && (
              <motion.div
                key="board"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: baseEase }}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                >
                  <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <DroppableColumn
                      id="today-column"
                      title="Today"
                      count={displayItems.today.length}
                      isEmpty={displayItems.today.length === 0}
                    >
                      <SortableContext items={displayItems.today.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        {displayItems.today.map((task) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            variant="primary"
                            onComplete={handleComplete}
                            onEdit={() => setEditingTask(task)}
                            isDragging={activeId === task.id}
                            justDropped={recentlyDropped === task.id}
                          />
                        ))}
                      </SortableContext>
                    </DroppableColumn>
                    <DroppableColumn
                      id="upnext-column"
                      title="Queued"
                      count={displayItems.upnext.length}
                      isEmpty={displayItems.upnext.length === 0}
                    >
                      <SortableContext items={displayItems.upnext.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        {displayItems.upnext.map((task) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            variant="primary"
                            onComplete={handleComplete}
                            onEdit={() => setEditingTask(task)}
                            isDragging={activeId === task.id}
                            justDropped={recentlyDropped === task.id}
                          />
                        ))}
                      </SortableContext>
                    </DroppableColumn>
                    <BacklogDropZone count={byStatus.backlog.length}>
                      <GroupedBacklog onEditMove={handleEditFromBacklog} />
                    </BacklogDropZone>
                  </motion.div>
                  <DragOverlay
                    dropAnimation={{
                      duration: 300,
                      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  >
                    {activeTask ? (
                      <div className="transform scale-105 rotate-2 shadow-2xl shadow-black/50 ring-2 ring-[color:var(--thanos-amethyst)]/50 rounded-xl">
                        <TaskCard task={activeTask} variant="primary" onComplete={handleComplete} isDragging={true} />
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </motion.div>
            )}

            {view === "list" && (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: baseEase }}
                className="space-y-6"
              >
                {/* Active & Queued - compact rows */}
                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900">
                    <h3 className="text-[11px] uppercase tracking-[0.3em] text-white/50">Active & Queued</h3>
                  </div>
                  <div className="divide-y divide-zinc-800/50">
                    {filteredTasks
                      .filter((t) => t.status === "today" || t.status === "upnext")
                      .map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 py-2 px-4 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                          onClick={() => setEditingTask(task)}
                        >
                          {/* Client badge - fixed width */}
                          <Badge
                            variant="outline"
                            className="w-24 justify-center text-xs shrink-0 truncate"
                            style={{
                              borderColor: task.clientColor || "#6b7280",
                              color: task.clientColor || "#6b7280",
                            }}
                          >
                            {task.client}
                          </Badge>

                          {/* Title - grows to fill space, truncate with ellipsis */}
                          <span className="flex-1 text-sm text-zinc-100 truncate">{task.title}</span>

                          {/* Points badge */}
                          {(() => {
                            const points = getTaskPoints(task)
                            const tierConfig = getValueTierConfig(task.valueTier)
                            return (
                              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium tabular-nums ${tierConfig.bgColor} ${tierConfig.color}`}>
                                {points}pt{points > 1 ? "s" : ""}
                              </span>
                            )
                          })()}

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleComplete(task.id)
                              }}
                            >
                              <Check className="h-4 w-4 text-zinc-500 hover:text-emerald-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    {filteredTasks.filter((t) => t.status === "today" || t.status === "upnext").length === 0 && (
                      <div className="py-4 px-4 text-sm text-zinc-500 text-center">No active or queued tasks</div>
                    )}
                  </div>
                </div>

                {/* Backlog section */}
                <div className="pt-4 border-t border-zinc-800">
                  <h2 className="text-[11px] uppercase tracking-[0.3em] text-white/50 mb-3">Backlog</h2>
                  <GroupedBacklog onEditMove={handleEditFromBacklog} />
                </div>
              </motion.div>
            )}

            {view === "focus" && (
              <motion.div
                key="focus"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: baseEase }}
                className="space-y-6"
              >
                <div className="flex flex-col gap-4">
                  {activeTasks.length === 0 ? (
                    <p className="text-zinc-500 text-center py-8">No active tasks. Promote something from backlog!</p>
                  ) : (
                    activeTasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        variant="primary"
                        onComplete={handleComplete}
                        onEdit={() => setEditingTask(task)}
                        isDragging={focusIndex === index}
                        onClick={() => setFocusIndex(index)}
                      />
                    ))
                  )}
                </div>
                <div className="pt-4 border-t border-zinc-800">
                  <h2 className="text-[11px] uppercase tracking-[0.3em] text-white/50 mb-3">Backlog</h2>
                  <GroupedBacklog onEditMove={handleEditFromBacklog} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="lg:hidden mt-4">
          <div className="flex flex-col gap-4">
            {activeTab === "today" &&
              (displayItems.today.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No tasks for today</p>
              ) : (
                displayItems.today.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    variant="compact"
                    onComplete={handleComplete}
                    onEdit={() => setEditingTask(task)}
                  />
                ))
              ))}
            {activeTab === "upnext" &&
              (displayItems.upnext.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No queued tasks</p>
              ) : (
                displayItems.upnext.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    variant="compact"
                    onComplete={handleComplete}
                    onEdit={() => setEditingTask(task)}
                  />
                ))
              ))}
            {activeTab === "backlog" && <GroupedBacklog onEditMove={handleEditFromBacklog} />}
          </div>
        </div>

        <motion.div variants={sectionVariants} className="mt-8 pt-4 border-t border-white/10">
          <Graveyard />
        </motion.div>
      </div>

      <NewTaskDialog
        open={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onSubmit={async (data) => {
          await createTask(data)
          refresh()
        }}
      />

      <EditTaskDialog
        open={!!editingTask}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (id: string, data: Record<string, unknown>) => {
          await updateTask(id, data)
          refresh()
        }}
        onUpdateSubtasks={async (id: string, subtasks: unknown[]) => {
          await updateSubtasks(id, subtasks as Parameters<typeof updateSubtasks>[1])
          refresh()
        }}
        onSetSubtasksFromTitles={async (id: string, titles: string[]) => {
          await setSubtasksFromTitles(id, titles)
          refresh()
        }}
        onDelete={async (id: string) => {
          await deleteTask(id)
          refresh()
        }}
      />
      </motion.div>
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: TasksView; onChange: (v: TasksView) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-zinc-900/70 border border-white/10 p-1">
      <button
        onClick={() => onChange("board")}
        className={`flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--thanos-amethyst)]/60 ${view === "board" ? "bg-[color:var(--thanos-amethyst)] text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Board
      </button>
      <button
        onClick={() => onChange("list")}
        className={`flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--thanos-amethyst)]/60 ${view === "list" ? "bg-[color:var(--thanos-amethyst)] text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
      >
        <List className="h-3.5 w-3.5" /> List
      </button>
      <button
        onClick={() => onChange("focus")}
        className={`flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--thanos-amethyst)]/60 ${view === "focus" ? "bg-[color:var(--thanos-amethyst)] text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
      >
        <Crosshair className="h-3.5 w-3.5" /> Focus
      </button>
    </div>
  )
}

function TaskCard({
  task,
  variant,
  onComplete,
  onClick,
  onEdit,
  isDragging = false,
}: {
  task: Task
  variant: TaskVariant
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
    await onComplete(task.id)
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

  const isCompact = variant === "compact"
  const taskPoints = getTaskPoints(task)
  const tierConfig = getValueTierConfig(task.valueTier)

  // Status-based card styling
  const getStatusStyles = () => {
    if (isDragging) {
      return "border-[color:var(--thanos-amethyst)]/50 bg-zinc-900 shadow-xl shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-2 ring-[color:var(--thanos-amethyst)]/30"
    }
    switch (task.status) {
      case "today":
        return "card-today border hover:border-[color:var(--thanos-amethyst)]/40 hover:shadow-lg hover:shadow-[0_0_18px_rgba(168,85,247,0.18)]"
      case "upnext":
        return "card-queued border hover:border-zinc-600 hover:shadow-lg"
      case "done":
        return "card-done border hover:border-emerald-500/40"
      default:
        return "card-backlog border hover:border-zinc-700"
    }
  }

  const subtasks = task.subtasks || []
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
      className={`group relative rounded-xl transition-all ${onClick ? "cursor-pointer" : "cursor-grab"} active:cursor-grabbing ${getStatusStyles()} ${isCompact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] uppercase tracking-[0.24em] text-white/50 ${isCompact ? "text-[10px]" : ""}`}>{task.client}</div>
          <h3
            className={`font-medium text-zinc-100 leading-snug break-words ${isCompact ? "text-sm mt-0.5" : "text-base mt-1"}`}
          >
            {task.title}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="flex-shrink-0 p-2 rounded-lg bg-zinc-900/60 border border-white/10 text-zinc-400 hover:bg-zinc-800/60 hover:text-white transition"
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
            aria-label={`Complete task: ${task.title}`}
            title={`Complete: ${task.title}`}
            className={`flex-shrink-0 p-2 rounded-lg btn-press focus-ring transition-all ${completing
              ? "bg-emerald-500 text-white animate-celebrate glow-success"
              : "bg-zinc-800 text-zinc-400 hover:bg-emerald-500/20 hover:text-emerald-400 hover:scale-105"
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
              className="h-full bg-[color:var(--thanos-amethyst)] transition-all duration-300"
              style={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 tabular-nums">
            {completedSubtasks}/{totalSubtasks}
          </span>
        </div>
      )}

      <div className={`flex items-center justify-between ${isCompact ? "mt-2" : "mt-3"}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${tierConfig.bgColor} ${tierConfig.color} font-medium tabular-nums`}>
            {taskPoints}pt{taskPoints > 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-xs text-white/40">{task.ageLabel}</span>
      </div>
    </motion.div>
  )
}

function UndoToast({
  undoState,
  onUndo,
}: {
  undoState: { id: string; previousStatus: TaskStatus } | null
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
            <button onClick={onUndo} className="text-sm font-medium text-[color:var(--thanos-gold)] hover:text-[color:var(--thanos-gold)]/80">
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DroppableColumn({
  id,
  title,
  count,
  isEmpty,
  children,
}: {
  id: string
  title: string
  count: number
  isEmpty: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: "column" },
  })

  const getColumnIcon = () => {
    switch (id) {
      case "today-column":
        return <Zap className="h-4 w-4 text-[color:var(--thanos-amethyst)]" />
      case "upnext-column":
        return <Clock className="h-4 w-4 text-[color:var(--thanos-cosmic)]" />
      default:
        return null
    }
  }

  const getEmptyMessage = () => {
    switch (id) {
      case "today-column":
        return { title: "Ready for action", subtitle: "Drag tasks here to tackle today", icon: <Zap className="h-5 w-5" /> }
      case "upnext-column":
        return { title: "Queue is clear", subtitle: "Add tasks for later", icon: <Clock className="h-5 w-5" /> }
      default:
        return { title: "Empty", subtitle: "Drop tasks here", icon: <Inbox className="h-5 w-5" /> }
    }
  }

  const emptyMsg = getEmptyMessage()

  return (
    <motion.div
      ref={setNodeRef}
      variants={itemVariants}
      className={`col-span-1 min-h-[240px] panel-obsidian rounded-xl border border-white/10 p-4 transition-all duration-200 ${isOver ? "ring-2 ring-[color:var(--thanos-amethyst)]/30 scale-[1.01]" : ""
        }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/50">
          {getColumnIcon()}
          {title}
        </div>
        <span className="text-xs text-white/40 font-mono tabular-nums">{count}</span>
      </div>
      {isEmpty && !isOver ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: baseEase }}
          className="flex flex-col items-center justify-center h-36 border border-dashed border-white/10 rounded-xl bg-zinc-950/40 text-center"
        >
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white/5 text-white/60 mb-2">
            {emptyMsg.icon}
          </div>
          <p className="text-zinc-300 text-sm font-medium">{emptyMsg.title}</p>
          <p className="text-zinc-500 text-xs mt-1">{emptyMsg.subtitle}</p>
        </motion.div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </motion.div>
  )
}

function SortableTaskCard({
  task,
  variant,
  onComplete,
  onEdit,
  isDragging: isDraggingProp,
  justDropped,
}: {
  task: Task
  variant: "primary" | "secondary"
  onComplete: (id: string) => void
  onEdit: () => void
  isDragging?: boolean
  justDropped?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // When just dropped, use spring animation for "thud" effect
    transition: justDropped
      ? "transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease"
      : transition || "transform 200ms ease",
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none ${justDropped ? "animate-thud" : ""}`}
    >
      <TaskCard
        task={task}
        variant={variant}
        onComplete={async (id) => onComplete(id)}
        onEdit={onEdit}
        isDragging={isDragging || isDraggingProp}
      />
    </div>
  )
}
