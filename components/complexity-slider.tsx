"use client"

import { useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"

interface ComplexitySliderProps {
  value: number
  onChange: (value: number) => void
  aiEstimate?: number | null
  className?: string
}

export const COMPLEXITY_CONFIG = [
  { min: 1, max: 2, label: "Quick", time: "<5 min", color: "emerald" },
  { min: 3, max: 4, label: "Routine", time: "15-30 min", color: "green" },
  { min: 5, max: 6, label: "Meaningful", time: "30-60 min", color: "yellow" },
  { min: 7, max: 8, label: "Heavy", time: "1-2 hours", color: "orange" },
  { min: 9, max: 10, label: "Major", time: "2+ hours", color: "rose" },
]

export function getComplexityInfo(value: number) {
  return COMPLEXITY_CONFIG.find((c) => value >= c.min && value <= c.max) || COMPLEXITY_CONFIG[2]
}

function getThumbColor(value: number): string {
  if (value <= 2) return "bg-emerald-500 shadow-emerald-500/50"
  if (value <= 4) return "bg-green-500 shadow-green-500/50"
  if (value <= 6) return "bg-yellow-500 shadow-yellow-500/50"
  if (value <= 8) return "bg-orange-500 shadow-orange-500/50"
  return "bg-rose-500 shadow-rose-500/50"
}

function getTextColor(value: number): string {
  if (value <= 2) return "text-emerald-400"
  if (value <= 4) return "text-green-400"
  if (value <= 6) return "text-yellow-400"
  if (value <= 8) return "text-orange-400"
  return "text-rose-400"
}

export function ComplexitySlider({ value, onChange, aiEstimate, className }: ComplexitySliderProps) {
  const info = useMemo(() => getComplexityInfo(value), [value])
  const thumbColor = useMemo(() => getThumbColor(value), [value])
  const textColor = useMemo(() => getTextColor(value), [value])
  const percentage = ((value - 1) / 9) * 100

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value))
    },
    [onChange]
  )

  const handleTickClick = useCallback(
    (tickValue: number) => {
      onChange(tickValue)
    },
    [onChange]
  )

  const aiInfo = aiEstimate ? getComplexityInfo(aiEstimate) : null
  const showAiDiff = aiEstimate && aiEstimate !== value

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with label and AI comparison */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn("text-2xl font-bold tabular-nums transition-colors", textColor)}>
            {value}
          </span>
          <div className="flex flex-col">
            <span className={cn("text-sm font-semibold transition-colors", textColor)}>
              {info.label}
            </span>
            <span className="text-xs text-zinc-500">{info.time}</span>
          </div>
        </div>

        {showAiDiff && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-[10px] text-indigo-400">AI suggested</span>
            <span className={cn("text-xs font-semibold", getTextColor(aiEstimate!))}>{aiEstimate}</span>
          </div>
        )}
      </div>

      {/* Slider container */}
      <div className="relative pt-2 pb-6">
        {/* Gradient track background */}
        <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
            style={{
              width: `${percentage}%`,
              background: "linear-gradient(to right, #10b981, #22c55e, #eab308, #f97316, #f43f5e)",
              backgroundSize: "1000% 100%",
              backgroundPosition: `${percentage}% 0`,
            }}
          />
        </div>

        {/* Custom styled range input */}
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={handleSliderChange}
          className="absolute inset-x-0 top-0 w-full h-6 opacity-0 cursor-pointer z-10"
        />

        {/* Custom thumb */}
        <div
          className={cn(
            "absolute top-0 w-6 h-6 rounded-full -translate-x-1/2 transition-all duration-150",
            "shadow-lg ring-2 ring-zinc-900",
            thumbColor
          )}
          style={{ left: `${percentage}%` }}
        >
          {/* Glow effect */}
          <div
            className={cn(
              "absolute inset-0 rounded-full animate-pulse opacity-50 blur-sm",
              thumbColor.split(" ")[0]
            )}
          />
        </div>

        {/* AI estimate marker */}
        {showAiDiff && (
          <div
            className="absolute top-0 w-1.5 h-6 rounded-full bg-indigo-500/60 -translate-x-1/2 transition-all"
            style={{ left: `${((aiEstimate! - 1) / 9) * 100}%` }}
            title={`AI suggested ${aiEstimate}`}
          />
        )}

        {/* Tick marks */}
        <div className="absolute inset-x-0 top-8 flex justify-between px-[2px]">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((tick) => (
            <button
              key={tick}
              type="button"
              onClick={() => handleTickClick(tick)}
              className={cn(
                "w-5 h-5 flex items-center justify-center text-[10px] font-medium rounded transition-all",
                "hover:bg-zinc-700/50",
                tick === value
                  ? cn(textColor, "font-bold")
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {tick}
            </button>
          ))}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-1 flex-wrap">
        {COMPLEXITY_CONFIG.map((config) => {
          const isActive = value >= config.min && value <= config.max
          const pillColor = {
            emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            green: "bg-green-500/20 text-green-400 border-green-500/30",
            yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
            orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
            rose: "bg-rose-500/20 text-rose-400 border-rose-500/30",
          }[config.color]

          return (
            <button
              key={config.label}
              type="button"
              onClick={() => onChange(config.min)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded-full border transition-all",
                isActive
                  ? pillColor
                  : "bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:bg-zinc-700/50"
              )}
            >
              {config.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
