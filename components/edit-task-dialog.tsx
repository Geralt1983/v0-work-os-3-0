"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { X, Wand2, GitBranch, Loader2, Square, CheckSquare, Trash2 } from "lucide-react"
import { ValueTierSelector } from "@/components/value-tier-selector"
import { motion, AnimatePresence } from "framer-motion"
import { useClients, type TaskStatus, type Task, type Subtask } from "@/hooks/use-tasks"
import { type ValueTier, DEFAULT_VALUE_TIER, VALUE_TIER_CONFIG, effortToValueTier } from "@/lib/domain/task-types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface EditTaskDialogProps {
  open: boolean
  task: Task | null
  onClose: () => void
  onSave: (
    id: string,
    data: {
      title: string
      clientId?: number
      description?: string
      status?: TaskStatus
      valueTier?: ValueTier
      drainType?: string
    },
  ) => Promise<void>
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => Promise<void>
  onSetSubtasksFromTitles?: (id: string, titles: string[]) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

const drainOptions = [
  { value: "deep", label: "Deep", color: "bg-rose-500" },
  { value: "shallow", label: "Shallow", color: "bg-amber-500" },
  { value: "admin", label: "Admin", color: "bg-blue-500" },
]

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "upnext", label: "Up Next" },
  { value: "today", label: "Today" },
]

export function EditTaskDialog({
  open,
  task,
  onClose,
  onSave,
  onUpdateSubtasks,
  onSetSubtasksFromTitles,
  onDelete,
}: EditTaskDialogProps) {
  const { clients, isLoading: clientsLoading } = useClients()

  const [title, setTitle] = useState("")
  const [clientId, setClientId] = useState<number | undefined>()
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<TaskStatus>("backlog")
  const [valueTier, setValueTier] = useState<ValueTier>(DEFAULT_VALUE_TIER)
  const [drainType, setDrainType] = useState<string>("shallow")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [subtasks, setSubtasks] = useState<Subtask[]>([])

  // AI feature states
  const [isRewriting, setIsRewriting] = useState(false)
  const [rewriteSuggestion, setRewriteSuggestion] = useState<string | null>(null)
  const [showRewriteConfirm, setShowRewriteConfirm] = useState(false)

  const [isBreakingDown, setIsBreakingDown] = useState(false)
  const [subtaskSuggestions, setSubtaskSuggestions] = useState<string[]>([])
  const [showSubtaskConfirm, setShowSubtaskConfirm] = useState(false)

  // Delete state and handler
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!task || !onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(task.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      console.error("Failed to delete task:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Populate form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setClientId(task.clientId)
      setDescription(task.description || "")
      setStatus(task.status === "done" ? "today" : task.status)
      // Use valueTier if present, otherwise convert from legacy effortEstimate
      setValueTier((task.valueTier as ValueTier) || effortToValueTier(task.effortEstimate))
      setDrainType(task.drainType || "shallow")
      setSubtasks(task.subtasks || [])
    }
  }, [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !task) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await onSave(task.id, {
        title: title.trim(),
        clientId,
        description: description.trim() || undefined,
        status,
        valueTier,
        drainType,
      })
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update task")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRewrite = async () => {
    if (!task) return
    setIsRewriting(true)
    try {
      const selectedClient = clients.find((c) => c.id === clientId)
      const tierConfig = VALUE_TIER_CONFIG[valueTier]
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: title,
          context: {
            client: selectedClient?.name,
            valueTier: valueTier,
            tierLabel: tierConfig.label,
          },
        }),
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error("Rewrite API error:", errorText)
        return
      }
      const data = await res.json()
      if (data.rewrite) {
        setRewriteSuggestion(data.rewrite)
        setShowRewriteConfirm(true)
      }
    } catch (error) {
      console.error("Rewrite error:", error)
    } finally {
      setIsRewriting(false)
    }
  }

  const handleBreakdown = async () => {
    if (!task) return
    setIsBreakingDown(true)
    try {
      const selectedClient = clients.find((c) => c.id === clientId)
      const res = await fetch(`/api/tasks/${task.id}/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          clientName: selectedClient?.name,
          valueTier,
        }),
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error("Breakdown API error:", errorText)
        return
      }
      const data = await res.json()
      if (data.subtasks && data.subtasks.length > 0) {
        setSubtaskSuggestions(data.subtasks)
        setShowSubtaskConfirm(true)
      }
    } catch (error) {
      console.error("Breakdown error:", error)
    } finally {
      setIsBreakingDown(false)
    }
  }

  const toggleSubtask = async (subtaskId: string) => {
    const updatedSubtasks = subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s))
    setSubtasks(updatedSubtasks)

    if (task && onUpdateSubtasks) {
      await onUpdateSubtasks(task.id, updatedSubtasks)
    }
  }

  const deleteSubtask = async (subtaskId: string) => {
    const updatedSubtasks = subtasks.filter((s) => s.id !== subtaskId)
    setSubtasks(updatedSubtasks)

    if (task && onUpdateSubtasks) {
      await onUpdateSubtasks(task.id, updatedSubtasks)
    }
  }

  const confirmSubtasks = async () => {
    if (task && onSetSubtasksFromTitles && subtaskSuggestions.length > 0) {
      await onSetSubtasksFromTitles(task.id, subtaskSuggestions)
      // Update local state
      const newSubtasks: Subtask[] = subtaskSuggestions.map((title) => ({
        id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title,
        completed: false,
      }))
      setSubtasks(newSubtasks)
    }
    setShowSubtaskConfirm(false)
    setSubtaskSuggestions([])
  }

  const confirmRewrite = async () => {
    if (rewriteSuggestion) {
      setTitle(rewriteSuggestion)
    }
    setShowRewriteConfirm(false)
  }

  if (!task) return null

  const completedCount = subtasks.filter((s) => s.completed).length
  const totalCount = subtasks.length

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <form
                onSubmit={handleSubmit}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                  <h2 className="text-base font-semibold text-white">Edit Task</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-4 py-2 space-y-2.5">
                  {submitError && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {submitError}
                    </div>
                  )}

                  {/* Title with Rewrite button */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-zinc-400">Title</label>
                      <button
                        type="button"
                        onClick={handleRewrite}
                        disabled={isRewriting || !title.trim()}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-[color:var(--thanos-amethyst)]/10 text-[color:var(--thanos-amethyst)] hover:bg-[color:var(--thanos-amethyst)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isRewriting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                        Rewrite
                      </button>
                    </div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[color:var(--thanos-amethyst)] focus:border-transparent transition text-sm"
                    />
                  </div>

                  {/* Client */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Client</label>
                    {clientsLoading ? (
                      <div className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-500 text-sm">
                        Loading clients...
                      </div>
                    ) : (
                      <select
                        value={clientId ?? ""}
                        onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--thanos-amethyst)] focus:border-transparent transition appearance-none cursor-pointer"
                      >
                        <option value="">No client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Status</label>
                    <div className="flex gap-1.5">
                      {statusOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(opt.value)}
                          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            status === opt.value
                              ? "bg-[color:var(--thanos-amethyst)] text-white"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Value Tier */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Value</label>
                    <ValueTierSelector
                      value={valueTier}
                      onChange={setValueTier}
                      aiSuggestion={task?.valueTier as ValueTier | null}
                      compact
                    />
                  </div>

                  {/* Drain Type */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Energy Type</label>
                    <div className="flex gap-1.5">
                      {drainOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDrainType(opt.value)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                            drainType === opt.value
                              ? "bg-zinc-700 text-white ring-2 ring-[color:var(--thanos-amethyst)]"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${opt.color}`} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Description <span className="text-zinc-600">(optional)</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add any notes or context..."
                      rows={1}
                      className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[color:var(--thanos-amethyst)] focus:border-transparent transition resize-none"
                    />
                  </div>

                  {subtasks.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-zinc-400">Subtasks</label>
                        <span className="text-xs text-zinc-500">
                          {completedCount}/{totalCount} done
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {subtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800/50 rounded-md group"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSubtask(subtask.id)}
                              className="flex-shrink-0 text-zinc-400 hover:text-[color:var(--thanos-amethyst)] transition"
                            >
                              {subtask.completed ? (
                                <CheckSquare className="h-4 w-4 text-[color:var(--thanos-amethyst)]" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                            <span
                              className={`flex-1 text-xs ${
                                subtask.completed ? "text-zinc-500 line-through" : "text-zinc-200"
                              }`}
                            >
                              {subtask.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteSubtask(subtask.id)}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subtask button */}
                  <div className="pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={handleBreakdown}
                      disabled={isBreakingDown}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isBreakingDown ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <GitBranch className="h-3.5 w-3.5" />
                      )}
                      {subtasks.length > 0 ? "Regenerate Subtasks" : "Break into Subtasks"}
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-zinc-800 flex justify-between gap-2">
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!title.trim() || isSubmitting}
                      className="px-4 py-2 rounded-lg text-xs font-medium bg-[color:var(--thanos-amethyst)] text-white hover:bg-[color:var(--thanos-amethyst)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isSubmitting ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete this task?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete "{task?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rewrite Confirmation Dialog */}
      <AlertDialog open={showRewriteConfirm} onOpenChange={setShowRewriteConfirm}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Rewrite Suggestion</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-zinc-400 space-y-3 mt-2">
                <div>
                  <span className="text-zinc-500 text-xs uppercase tracking-wide">Original:</span>
                  <div className="text-zinc-300 mt-1">{title}</div>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs uppercase tracking-wide">Suggested:</span>
                  <div className="text-[color:var(--thanos-amethyst)] mt-1 font-medium">{rewriteSuggestion}</div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">
              Keep Original
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmRewrite} className="bg-[color:var(--thanos-amethyst)] text-white hover:bg-[color:var(--thanos-amethyst)]/80">
              Use Suggestion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subtask Confirmation Dialog */}
      <AlertDialog open={showSubtaskConfirm} onOpenChange={setShowSubtaskConfirm}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Add Subtasks</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-zinc-400 space-y-2 mt-2">
                <span className="text-zinc-500 text-xs uppercase tracking-wide">Suggested subtasks:</span>
                <ul className="space-y-2 mt-2">
                  {subtaskSuggestions.map((subtask, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Square className="h-4 w-4 text-[color:var(--thanos-amethyst)] mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-300">{subtask}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-zinc-500 text-sm mt-4">
                  These subtasks will be added to this task and shown on the card.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubtasks} className="bg-[color:var(--thanos-amethyst)] text-white hover:bg-[color:var(--thanos-amethyst)]/80">
              Add Subtasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
