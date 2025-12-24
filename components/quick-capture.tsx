"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Minus, Sparkles, Send } from "lucide-react"
import { cn } from "@/lib/utils"

interface EstimateResult {
  client: string | null
  title: string
  complexity: number
  reasoning: string
  confidence: number
  raw_input: string
}

interface QuickCaptureProps {
  onMoveCreated?: () => void
}

export function QuickCapture({ onMoveCreated }: QuickCaptureProps) {
  const [input, setInput] = useState("")
  const [isEstimating, setIsEstimating] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [adjustedComplexity, setAdjustedComplexity] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentComplexity = adjustedComplexity ?? estimate?.complexity ?? 0

  const handleEstimate = useCallback(async () => {
    if (!input.trim()) return

    setIsEstimating(true)
    setError(null)
    setEstimate(null)
    setAdjustedComplexity(null)

    try {
      const res = await fetch("/api/ai/estimate-complexity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_input: input.trim() }),
      })

      if (!res.ok) throw new Error("Failed to estimate")

      const data: EstimateResult = await res.json()
      setEstimate(data)
    } catch (err) {
      setError("Failed to estimate complexity")
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

    try {
      const res = await fetch("/api/moves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: estimate.title,
          status: "backlog",
          complexityAiGuess: estimate.complexity,
          complexityFinal: adjustedComplexity,
        }),
      })

      if (!res.ok) throw new Error("Failed to create move")

      // Reset state
      setInput("")
      setEstimate(null)
      setAdjustedComplexity(null)
      onMoveCreated?.()
    } catch (err) {
      setError("Failed to add move")
      console.error(err)
    } finally {
      setIsAdding(false)
    }
  }

  const adjustComplexity = (delta: number) => {
    const current = adjustedComplexity ?? estimate?.complexity ?? 5
    const newValue = Math.max(1, Math.min(10, current + delta))
    setAdjustedComplexity(newValue)
  }

  const resetCapture = () => {
    setEstimate(null)
    setAdjustedComplexity(null)
    setError(null)
  }

  const getComplexityColor = (value: number) => {
    if (value <= 2) return "text-emerald-400"
    if (value <= 4) return "text-green-400"
    if (value <= 6) return "text-yellow-400"
    if (value <= 8) return "text-orange-400"
    return "text-red-400"
  }

  const getComplexityLabel = (value: number) => {
    if (value <= 2) return "Trivial"
    if (value <= 4) return "Routine"
    if (value <= 6) return "Meaningful"
    if (value <= 8) return "Heavy"
    return "Major"
  }

  return (
    <div className="w-full space-y-3">
      {/* Input Section */}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What needs to get done?"
          disabled={isEstimating || !!estimate}
          className={cn(
            "w-full px-4 py-3 rounded-lg",
            "bg-zinc-900 border border-zinc-800",
            "text-zinc-100 placeholder:text-zinc-500",
            "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500",
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
              "p-2 rounded-md",
              "bg-violet-600 hover:bg-violet-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-200"
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
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-4">
          {/* Client & Title */}
          <div className="space-y-1">
            {estimate.client && (
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-violet-600/20 text-violet-400 border border-violet-500/30">
                {estimate.client}
              </span>
            )}
            <h3 className="text-lg font-medium text-zinc-100">{estimate.title}</h3>
          </div>

          {/* Complexity Display & Adjustment */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => adjustComplexity(-1)}
                disabled={currentComplexity <= 1}
                className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600"
              >
                <Minus className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-2">
                <span className={cn("text-3xl font-bold tabular-nums", getComplexityColor(currentComplexity))}>
                  {currentComplexity}
                </span>
                <div className="flex flex-col">
                  <span className={cn("text-sm font-medium", getComplexityColor(currentComplexity))}>
                    {getComplexityLabel(currentComplexity)}
                  </span>
                  <span className="text-xs text-zinc-500">complexity</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => adjustComplexity(1)}
                disabled={currentComplexity >= 10}
                className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {adjustedComplexity !== null && adjustedComplexity !== estimate.complexity && (
              <span className="text-xs text-zinc-500">
                AI said {estimate.complexity}
              </span>
            )}
          </div>

          {/* Reasoning */}
          <p className="text-sm text-zinc-400">{estimate.reasoning}</p>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleAddToBacklog}
              disabled={isAdding}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
            >
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Add to Backlog
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={resetCapture}
              disabled={isAdding}
              className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
