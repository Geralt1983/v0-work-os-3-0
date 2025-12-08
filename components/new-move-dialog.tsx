"use client"

import type React from "react"

import { useState } from "react"
import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useClients, type MoveStatus } from "@/hooks/use-moves"

interface NewMoveDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    clientId?: number
    clientName?: string // Add clientName to pass to createMove
    description?: string
    status?: MoveStatus
    effortEstimate?: number
    drainType?: string
  }) => Promise<void>
}

const effortOptions = [
  { value: 1, label: "Quick", description: "~20 min" },
  { value: 2, label: "Standard", description: "~40 min" },
  { value: 3, label: "Chunky", description: "~60 min" },
  { value: 4, label: "Deep", description: "~80+ min" },
]

const drainOptions = [
  { value: "easy", label: "Easy", color: "bg-emerald-500" },
  { value: "admin", label: "Admin", color: "bg-blue-500" },
  { value: "comms", label: "Comms", color: "bg-amber-500" },
  { value: "creative", label: "Creative", color: "bg-purple-500" },
  { value: "deep", label: "Deep", color: "bg-rose-500" },
]

const statusOptions: { value: MoveStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "upnext", label: "Up Next" },
  { value: "today", label: "Today" },
]

export function NewMoveDialog({ open, onClose, onSubmit }: NewMoveDialogProps) {
  const { clients, isLoading: clientsLoading, error: clientsError } = useClients()
  console.log("[v0] NewMoveDialog clients:", { clients, clientsLoading, clientsError })

  const [title, setTitle] = useState("")
  const [clientId, setClientId] = useState<number | undefined>()
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<MoveStatus>("backlog")
  const [effortEstimate, setEffortEstimate] = useState(2)
  const [drainType, setDrainType] = useState<string>("easy")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)

    const selectedClient = clients.find((c) => c.id === clientId)

    console.log("[v0] NewMoveDialog: submitting", {
      title: title.trim(),
      clientId,
      clientName: selectedClient?.name,
      description: description.trim() || undefined,
      status,
      effortEstimate,
      drainType,
    })

    try {
      await onSubmit({
        title: title.trim(),
        clientId,
        clientName: selectedClient?.name, // Pass clientName for immediate display
        description: description.trim() || undefined,
        status,
        effortEstimate,
        drainType,
      })
      console.log("[v0] NewMoveDialog: submit successful")
      // Reset form
      setTitle("")
      setClientId(undefined)
      setDescription("")
      setStatus("backlog")
      setEffortEstimate(2)
      setDrainType("easy")
      onClose()
    } catch (error) {
      console.error("[v0] NewMoveDialog: submit error", error)
      setSubmitError(error instanceof Error ? error.message : "Failed to create move")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
          >
            <form
              onSubmit={handleSubmit}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <h2 className="text-lg font-semibold text-white">New Move</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                {submitError && (
                  <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    {submitError}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition"
                    autoFocus
                  />
                </div>

                {/* Client */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Client</label>
                  {clientsLoading ? (
                    <div className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-500">
                      Loading clients...
                    </div>
                  ) : clientsError ? (
                    <div className="w-full px-4 py-3 bg-zinc-800 border border-red-700 rounded-xl text-red-400">
                      Error loading clients
                    </div>
                  ) : (
                    <select
                      value={clientId ?? ""}
                      onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition appearance-none cursor-pointer"
                    >
                      <option value="">No client ({clients.length} available)</option>
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
                  {isSubmitting ? "Creating..." : "Create Move"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
