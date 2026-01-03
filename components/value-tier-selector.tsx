"use client"

import { cn } from "@/lib/utils"
import {
  type ValueTier,
  VALUE_TIER_CONFIG,
  VALUE_POINTS,
  DEFAULT_VALUE_TIER,
} from "@/lib/domain/task-types"

interface ValueTierSelectorProps {
  value: ValueTier | string | null | undefined
  onChange: (tier: ValueTier) => void
  aiSuggestion?: ValueTier | null
  className?: string
  compact?: boolean
}

const TIER_ORDER: ValueTier[] = ["checkbox", "progress", "deliverable", "milestone"]

export function ValueTierSelector({
  value,
  onChange,
  aiSuggestion,
  className,
  compact = false,
}: ValueTierSelectorProps) {
  const currentTier = (value as ValueTier) || DEFAULT_VALUE_TIER

  return (
    <div className={cn("space-y-2", className)}>
      {/* Tier buttons */}
      <div className={cn(
        "grid gap-2",
        compact ? "grid-cols-4" : "grid-cols-2"
      )}>
        {TIER_ORDER.map((tier) => {
          const config = VALUE_TIER_CONFIG[tier]
          const points = VALUE_POINTS[tier]
          const isSelected = currentTier === tier
          const isAiSuggested = aiSuggestion === tier && !isSelected

          return (
            <button
              key={tier}
              type="button"
              onClick={() => onChange(tier)}
              className={cn(
                "relative flex flex-col items-start p-3 rounded-xl border transition-all text-left",
                "hover:scale-[1.02] active:scale-[0.98]",
                isSelected
                  ? cn(config.bgColor, config.borderColor, "ring-2 ring-offset-1 ring-offset-zinc-900", config.borderColor.replace("border-", "ring-"))
                  : "bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600",
                compact && "p-2"
              )}
            >
              {/* AI suggestion indicator */}
              {isAiSuggested && (
                <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-medium bg-indigo-500 text-white rounded-full">
                  AI
                </div>
              )}

              {/* Points badge */}
              <div className={cn(
                "text-lg font-bold tabular-nums",
                isSelected ? config.color : "text-zinc-400"
              )}>
                {points}pt{points > 1 ? "s" : ""}
              </div>

              {/* Label */}
              <div className={cn(
                "text-sm font-medium",
                isSelected ? config.color : "text-zinc-300"
              )}>
                {config.label}
              </div>

              {/* Description - hide in compact mode */}
              {!compact && (
                <div className="text-xs text-zinc-500 mt-0.5">
                  {config.description}
                </div>
              )}
            </button>
          )
        })}
      </div>

    </div>
  )
}

/**
 * Inline version for displaying the current tier (read-only)
 */
export function ValueTierBadge({
  tier,
  showPoints = true,
  className,
}: {
  tier: ValueTier | string | null | undefined
  showPoints?: boolean
  className?: string
}) {
  const currentTier = (tier as ValueTier) || DEFAULT_VALUE_TIER
  const config = VALUE_TIER_CONFIG[currentTier]
  const points = VALUE_POINTS[currentTier]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border",
        config.bgColor,
        config.borderColor,
        config.color,
        className
      )}
    >
      {config.label}
      {showPoints && (
        <span className="opacity-70">
          {points}pt{points > 1 ? "s" : ""}
        </span>
      )}
    </span>
  )
}
