// Time-aware pacing and momentum calculations (points-based)
import { DAILY_TARGET_POINTS } from "./constants"
import { WORK_START_HOUR, WORK_END_HOUR } from "./constants"

export interface MomentumResult {
  percent: number
  status: "crushing" | "on_track" | "behind" | "stalled"
  label: string
  expectedByNow: number
  actualPoints: number
  dayProgress: number
}

export function calculateMomentum(earnedPoints: number): MomentumResult {
  // Work day: 9am - 6pm EST (9 hours)
  const now = new Date()

  // Convert to EST
  const estOffset = -5 * 60 // EST offset in minutes
  const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60 * 1000)
  const hour = estNow.getHours()
  const minute = estNow.getMinutes()
  const currentTimeDecimal = hour + minute / 60

  const workDayHours = WORK_END_HOUR - WORK_START_HOUR // 9 hours

  // Calculate how far through the work day we are (0-1)
  let dayProgress = 0
  if (currentTimeDecimal < WORK_START_HOUR) {
    dayProgress = 0
  } else if (currentTimeDecimal >= WORK_END_HOUR) {
    dayProgress = 1
  } else {
    dayProgress = (currentTimeDecimal - WORK_START_HOUR) / workDayHours
  }

  // Expected points by now
  const expectedPoints = Math.round(DAILY_TARGET_POINTS * dayProgress)

  // Calculate momentum percentage
  let percent: number
  if (expectedPoints > 0) {
    percent = Math.round((earnedPoints / expectedPoints) * 100)
  } else {
    // Before work day starts
    percent = earnedPoints > 0 ? 100 : 0
  }

  // Determine status and label
  let status: "crushing" | "on_track" | "behind" | "stalled"
  let label: string

  if (percent >= 120) {
    status = "crushing"
    label = "Crushing it"
  } else if (percent >= 80) {
    status = "on_track"
    label = "On track"
  } else if (percent >= 50) {
    status = "behind"
    label = "Behind pace"
  } else {
    status = "stalled"
    label = "Stalled"
  }

  return {
    percent,
    status,
    label,
    expectedByNow: expectedPoints,
    actualPoints: earnedPoints,
    dayProgress: Math.round(dayProgress * 100),
  }
}

export function getMomentumIcon(status: "crushing" | "on_track" | "behind" | "stalled"): string {
  switch (status) {
    case "crushing":
      return "fire"
    case "on_track":
      return "check"
    case "behind":
      return "warning"
    case "stalled":
      return "alert"
  }
}

export function getMomentumColor(status: "crushing" | "on_track" | "behind" | "stalled"): string {
  switch (status) {
    case "crushing":
      return "text-emerald-400"
    case "on_track":
      return "text-cyan-400"
    case "behind":
      return "text-amber-400"
    case "stalled":
      return "text-rose-400"
  }
}
