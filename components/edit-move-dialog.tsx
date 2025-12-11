"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { X, Wand2, GitBranch, Loader2, Square, CheckSquare, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useClients, type MoveStatus, type Move, type Subtask } from "@/hooks/use-moves"
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

interface EditMoveDialogProps {
  open: boolean
  move: Move | null
  onClose: () => void
  onSave: (
    id: string,
    data: {
      title: string
      clientId?: number
      description?: string
      status?: MoveStatus
      effortEstimate?: number
      drainType?: string
    },
  ) => Promise<void>
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => Promise<void>
  onSetSubtasksFromTitles?: (id: string, titles: string[]) => Promise<void>
}

const effortOptions = [
  { value: 1, label: "Quick", description: "~20 min" },
  { value: 2, label: "Standard", description: "~40 min" },
  { value: 3, label: "Chunky", description: "~60 min" },
  { value: 4, label: "Deep", description: "~80+ min" },
]

const drainOptions = [
  { value: "deep", label: "Deep", color: "bg-rose-500" },
  { value: "shallow", label: "Shallow", color: "bg-amber-500" },
  { value: "admin", label: "Admin", color: "bg-blue-500" },
]

const statusOptions: { value: MoveStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "upnext", label: "Up Next" },
  { value: "today", label: "Today" },
]

function typeToEffort(type: Move["type"]): number {
  switch (type) {
    case "Quick":
      return 1
    case "Standard":
      return 2
    case "Chunky":
      return 3
    case "Deep":
      return 4
    default:
      return 2
  }
}

export function EditMoveDialog({
  open,
  move,
  onClose,
  onSave,
  onUpdateSubtasks,
  onSetSubtasksFromTitles,
}: EditMoveDialogProps) {
  const { clients, isLoading: clientsLoading } = useClients()

  const [title, setTitle] = useState("")
  const [clientId, setClientId] = useState<number | undefined>()
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<MoveStatus>("backlog")
  const [effortEstimate, setEffortEstimate] = useState(2)
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

  // Populate form when move changes
  useEffect(() => {
    if (move) {
      setTitle(move.title)
      setClientId(move.clientId)
      setDescription(move.description || "")
      setStatus(move.status === "done" ? "today" : move.status)
      setEffortEstimate(typeToEffort(move.type))
      setDrainType("shallow")
      setSubtasks(move.subtasks || [])
    }
  }, [move])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !move) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await onSave(move.id, {
        title: title.trim(),
        clientId,
        description: description.trim() || undefined,
        status,
        effortEstimate,
        drainType,
      })
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update move")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRewrite = async () => {
    if (!move) return
    setIsRewriting(true)
    try {
      const selectedClient = clients.find((c) => c.id === clientId)
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: title,
          context: {
            client: selectedClient?.name,
            type: effortOptions.find((e) => e.value === effortEstimate)?.label,
            timebox_minutes: effortEstimate * 20,
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
    if (!move) return
    setIsBreakingDown(true)
    try {
      const selectedClient = clients.find((c) => c.id === clientId)
      const res = await fetch(`/api/moves/${move.id}/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          clientName: selectedClient?.name,
          effortEstimate,
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

    if (move && onUpdateSubtasks) {
      await onUpdateSubtasks(move.id, updatedSubtasks)
    }
  }

  const deleteSubtask = async (subtaskId: string) => {
    const updatedSubtasks = subtasks.filter((s) => s.id !== subtaskId)
    setSubtasks(updatedSubtasks)

    if (move && onUpdateSubtasks) {
      await onUpdateSubtasks(move.id, updatedSubtasks)
    }
  }

  const confirmSubtasks = async () => {
    if (move && onSetSubtasksFromTitles && subtaskSuggestions.length > 0) {
      await onSetSubtasksFromTitles(move.id, subtaskSuggestions)
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

  if (!move) return null

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
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                  <h2 className="text-lg font-semibold text-white">Edit Move</h2>
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
                <div className="px-6 py-5 space-y-5">
                  {submitError && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {submitError}
                    </div>
                  )}

                  {/* Title with Rewrite button */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-zinc-400">Title</label>
                      <button
                        type="button"
                        onClick={handleRewrite}
                        disabled={isRewriting || !title.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition"
                    />
                  </div>

                  {/* Client */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Client</label>
                    {clientsLoading ? (
                      <div className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-500">
                        Loading clients...
                      </div>
                    ) : (
                      <select
                        value={clientId ?? ""}
                        onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition appearance-none cursor-pointer"
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
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Status</label>
                    <div className="flex gap-2">
                      {statusOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(opt.value)}
                          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                            status === opt.value
                              ? "bg-fuchsia-500 text-white"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Effort */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Effort</label>
                    <div className="grid grid-cols-4 gap-2">
                      {effortOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEffortEstimate(opt.value)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium transition flex flex-col items-center ${
                            effortEstimate === opt.value
                              ? "bg-fuchsia-500 text-white"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          <span>{opt.label}</span>
                          <span className="text-xs opacity-70">{opt.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Drain Type */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Energy Type</label>
                    <div className="flex flex-wrap gap-2">
                      {drainOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDrainType(opt.value)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                            drainType === opt.value
                              ? "bg-zinc-700 text-white ring-2 ring-fuchsia-500"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                      Description <span className="text-zinc-600">(optional)</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add any notes or context..."
                      rows={3}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition resize-none"
                    />
                  </div>

                  {subtasks.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-zinc-400">Subtasks</label>
                        <span className="text-xs text-zinc-500">
                          {completedCount}/{totalCount} done
                        </span>
                      </div>
                      <div className="space-y-2">
                        {subtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 rounded-lg group"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSubtask(subtask.id)}
                              className="flex-shrink-0 text-zinc-400 hover:text-fuchsia-400 transition"
                            >
                              {subtask.completed ? (
                                <CheckSquare className="h-5 w-5 text-fuchsia-500" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                            <span
                              className={`flex-1 text-sm ${
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
                              <Trash2 className="h-4 w-4" />
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
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isBreakingDown ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <GitBranch className="h-4 w-4" />
                      )}
                      {subtasks.length > 0 ? "Regenerate Subtasks" : "Break into Subtasks"}
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium bg-fuchsia-500 text-white hover:bg-fuchsia-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                  <div className="text-fuchsia-400 mt-1 font-medium">{rewriteSuggestion}</div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">
              Keep Original
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmRewrite} className="bg-fuchsia-500 text-white hover:bg-fuchsia-600">
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
                      <Square className="h-4 w-4 text-fuchsia-500 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-300">{subtask}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-zinc-500 text-sm mt-4">
                  These subtasks will be added to this move and shown on the card.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubtasks} className="bg-fuchsia-500 text-white hover:bg-fuchsia-600">
              Add Subtasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
