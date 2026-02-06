"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Loader2, Sparkles, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { useClients } from "@/hooks/use-tasks"
import {
  VALUE_TIER_CONFIG,
  VALUE_POINTS,
  type ValueTier,
} from "@/lib/domain/task-types"
import { ValueTierSelector, ValueTierBadge } from "@/components/value-tier-selector"

interface EstimateResult {
  client: string | null
  title: string
  valueTier: ValueTier
  points: number
  reasoning: string
  confidence: number
  raw_input: string
}

interface QuickCaptureProps {
  onTaskCreated?: () => void
}

export function QuickCapture({ onTaskCreated }: QuickCaptureProps) {
  const { clients } = useClients()
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState("")
  const [isEstimating, setIsEstimating] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [adjustedTier, setAdjustedTier] = useState<ValueTier | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>("none")
  const [error, setError] = useState<string | null>(null)

  const currentTier = adjustedTier ?? estimate?.valueTier ?? "progress"
  const currentPoints = VALUE_POINTS[currentTier]

  useEffect(() => {
    const onFocus = () => {
      if (isEstimating || !!estimate) return
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }

    window.addEventListener("workos:focus-quick-capture", onFocus)
    return () => window.removeEventListener("workos:focus-quick-capture", onFocus)
  }, [estimate, isEstimating])

  // When estimate comes in, try to match the detected client
  useEffect(() => {
    if (estimate?.client && clients.length > 0) {
      const matched = clients.find(
        (c) => c.name.toLowerCase() === estimate.client?.toLowerCase()
      )
      if (matched) {
        setSelectedClientId(String(matched.id))
      } else {
        setSelectedClientId("none")
      }
    }
  }, [estimate?.client, clients])

  const handleEstimate = useCallback(async () => {
    if (!input.trim()) return

    setIsEstimating(true)
    setError(null)
    setEstimate(null)
    setAdjustedTier(null)
    setSelectedClientId("none")

    try {
      const res = await fetch("/api/ai/estimate-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_input: input.trim() }),
      })

      if (!res.ok) throw new Error("Failed to estimate")

      const data: EstimateResult = await res.json()
      setEstimate(data)
    } catch (err) {
      setError("Failed to estimate value tier")
      console.error(err)
    } finally {
      setIsEstimating(false)
    }
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !estimate) {
      e.preventDefault()
      handleEstimate()
    }
  }

  const handleAddToBacklog = async () => {
    if (!estimate) return

    setIsAdding(true)
    setError(null)

    const clientId = selectedClientId !== "none" ? Number(selectedClientId) : null

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: estimate.title,
          status: "backlog",
          clientId,
          valueTier: currentTier,
        }),
      })

      if (!res.ok) throw new Error("Failed to create task")

      // Reset state
      setInput("")
      setEstimate(null)
      setAdjustedTier(null)
      setSelectedClientId("none")
      onTaskCreated?.()
    } catch (err) {
      setError("Failed to add task")
      console.error(err)
    } finally {
      setIsAdding(false)
    }
  }

  const resetCapture = () => {
    setInput("")
    setEstimate(null)
    setAdjustedTier(null)
    setSelectedClientId("none")
    setError(null)
  }

  const tierConfig = VALUE_TIER_CONFIG[currentTier]

  return (
    <div className="w-full space-y-3">
      {/* Input Section with glow effect */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-[color:var(--thanos-amethyst)]/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the task to estimate points..."
          disabled={isEstimating || !!estimate}
          className={cn(
            "relative w-full px-4 py-3.5 rounded-xl",
            "bg-zinc-950/40 border border-white/10",
            "text-zinc-100 placeholder:text-zinc-500",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--thanos-amethyst)]/40 focus-visible:border-[color:var(--thanos-amethyst)]/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-200"
          )}
        />
        {!estimate && (
          <button
            onClick={handleEstimate}
            disabled={!input.trim() || isEstimating}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2",
              "p-2.5 rounded-lg btn-press",
              "bg-[color:var(--thanos-amethyst)] hover:bg-[color:var(--thanos-amethyst)]/90 text-white",
              "shadow-[0_0_16px_rgba(168,85,247,0.25)]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
              "transition-all duration-200"
            )}
          >
            {isEstimating ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Estimate Result */}
      {estimate && (
        <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/10 space-y-4 animate-fade-in-up">
          {/* Client Selector & Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-[160px] bg-zinc-950/60 border border-white/10 text-zinc-100">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none" className="text-zinc-400 focus:bg-zinc-800 focus:text-zinc-100">
                    No client
                  </SelectItem>
                  {clients.map((client) => (
                    <SelectItem
                      key={client.id}
                      value={String(client.id)}
                      className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {estimate.client && selectedClientId === "none" && (
                <span className="text-xs text-zinc-500">
                  AI detected: {estimate.client}
                </span>
              )}
            </div>
            <h3 className="text-lg font-medium text-zinc-100">{estimate.title}</h3>
          </div>

          {/* Value Tier Display & Adjustment */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={cn("text-3xl font-bold tabular-nums", tierConfig.color)}>
                  {currentPoints}
                </span>
                <div className="flex flex-col">
                  <span className={cn("text-sm font-medium", tierConfig.color)}>
                    {tierConfig.label}
                  </span>
                  <span className="text-xs text-zinc-500">{tierConfig.description}</span>
                </div>
              </div>

              {adjustedTier !== null && adjustedTier !== estimate.valueTier && (
                <span className="text-xs text-zinc-500">
                  AI suggested: {VALUE_TIER_CONFIG[estimate.valueTier].label}
                </span>
              )}
            </div>

            {/* Tier Selector */}
            <ValueTierSelector
              value={currentTier}
              onChange={(tier) => setAdjustedTier(tier)}
              aiSuggestion={estimate.valueTier}
              compact
            />
          </div>

          {/* Reasoning */}
          <p className="text-sm text-zinc-400">{estimate.reasoning}</p>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleAddToBacklog}
              disabled={isAdding}
              className="flex-1 rounded-lg bg-[color:var(--thanos-amethyst)] text-white hover:bg-[color:var(--thanos-amethyst)]/90 shadow-[0_0_16px_rgba(168,85,247,0.25)] btn-press transition-all"
            >
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Add to Backlog
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={resetCapture}
              disabled={isAdding}
              className="rounded-lg bg-zinc-900/60 border-white/10 hover:bg-zinc-800/60 text-zinc-300 btn-press transition-all"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
