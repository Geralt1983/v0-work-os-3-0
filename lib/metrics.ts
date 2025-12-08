// Time-aware pacing and momentum calculations

export interface MomentumResult {
  percent: number
  status: "crushing" | "on_track" | "behind" | "stalled"
  label: string
  expectedByNow: number
  actualMinutes: number
  dayProgress: number
}

export function calculateMomentum(completedMinutes: number): MomentumResult {
  // Work day: 9am - 6pm EST (9 hours)
  const now = new Date()

  // Convert to EST
  const estOffset = -5 * 60 // EST offset in minutes
  const estNow = new Date(now.getTime() + (now.getTimezoneOffset() + estOffset) * 60 * 1000)
  const hour = estNow.getHours()
  const minute = estNow.getMinutes()
  const currentTimeDecimal = hour + minute / 60

  const workDayStart = 9 // 9am
  const workDayEnd = 18 // 6pm
  const workDayHours = workDayEnd - workDayStart // 9 hours
  const targetMinutes = 180

  // Calculate how far through the work day we are (0-1)
  let dayProgress = 0
  if (currentTimeDecimal < workDayStart) {
    dayProgress = 0
  } else if (currentTimeDecimal >= workDayEnd) {
    dayProgress = 1
  } else {
    dayProgress = (currentTimeDecimal - workDayStart) / workDayHours
  }

  // Expected minutes by now
  const expectedMinutes = Math.round(targetMinutes * dayProgress)

  // Calculate momentum percentage
  let percent: number
  if (expectedMinutes > 0) {
    percent = Math.round((completedMinutes / expectedMinutes) * 100)
  } else {
    // Before work day starts
    percent = completedMinutes > 0 ? 100 : 0
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
    expectedByNow: expectedMinutes,
    actualMinutes: completedMinutes,
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
