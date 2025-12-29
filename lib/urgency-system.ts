// =============================================================================
// URGENCY ESCALATION SYSTEM
// Points-based urgency that increases as day progresses and work underperforms
// =============================================================================

import { DAILY_TARGET_POINTS, DAILY_MINIMUM_POINTS } from "@/lib/constants"

// Expected points by hour (EST) - linear progression assumption
export const EXPECTED_POINTS_BY_HOUR: Record<number, number> = {
  8: 0,     // Morning start - 0%
  9: 2.25,  // 12.5%
  10: 4.5,  // 25%
  11: 6,    // 33%
  12: 9,    // 50% - halfway point
  13: 10.5, // 58%
  14: 12,   // 67% - minimum daily goal
  15: 13.5, // 75%
  16: 15,   // 83%
  17: 16.5, // 92%
  18: 18,   // 100% - target
}

// Get expected points for current hour (with interpolation)
export function getExpectedPoints(hour: number): number {
  if (hour < 8) return 0
  if (hour >= 18) return DAILY_TARGET_POINTS

  // If exact hour exists, use it
  if (EXPECTED_POINTS_BY_HOUR[hour]) {
    return EXPECTED_POINTS_BY_HOUR[hour]
  }

  // Linear interpolation between hours
  const lowerHour = Math.floor(hour)
  const upperHour = Math.ceil(hour)
  const fraction = hour - lowerHour

  const lowerPoints = EXPECTED_POINTS_BY_HOUR[lowerHour] || 0
  const upperPoints = EXPECTED_POINTS_BY_HOUR[upperHour] || DAILY_TARGET_POINTS

  return lowerPoints + (upperPoints - lowerPoints) * fraction
}

// Calculate how far behind/ahead of schedule
export interface PaceAnalysis {
  currentPoints: number
  expectedPoints: number
  delta: number // Positive = ahead, negative = behind
  percentOfExpected: number
  percentOfDailyTarget: number
  isCritical: boolean // More than 3 points behind
  isUrgent: boolean // More than 1.5 points behind
  isWarning: boolean // More than 0.5 points behind
  isPerfect: boolean // Within 0.5 points of expected
  isAhead: boolean // More than 0.5 points ahead
}

export function analyzePace(earnedPoints: number, hour: number): PaceAnalysis {
  const expectedPoints = getExpectedPoints(hour)
  const delta = earnedPoints - expectedPoints

  return {
    currentPoints: earnedPoints,
    expectedPoints,
    delta,
    percentOfExpected: expectedPoints > 0 ? Math.round((earnedPoints / expectedPoints) * 100) : 100,
    percentOfDailyTarget: Math.round((earnedPoints / DAILY_TARGET_POINTS) * 100),
    isCritical: delta < -3,
    isUrgent: delta < -1.5,
    isWarning: delta < -0.5,
    isPerfect: Math.abs(delta) <= 0.5,
    isAhead: delta > 0.5,
  }
}

// Determine notification priority based on pace
export function getUrgencyPriority(pace: PaceAnalysis): "min" | "low" | "default" | "high" | "urgent" {
  if (pace.isCritical) return "urgent"
  if (pace.isUrgent) return "high"
  if (pace.isWarning) return "high"
  if (pace.isAhead) return "low"
  return "default"
}

// Calculate pressure level (0-5 scale) based on performance
export function calculatePressureLevel(earnedPoints: number, dailyDebt: number, weeklyDebt: number, hour: number): number {
  const pace = analyzePace(earnedPoints, hour)
  let pressure = 0

  // Base pressure from current pace
  if (pace.isCritical) pressure += 3
  else if (pace.isUrgent) pressure += 2
  else if (pace.isWarning) pressure += 1

  // Add pressure from daily debt
  if (dailyDebt > 0) {
    pressure += Math.min(1, dailyDebt / 6) // 0-1 based on debt
  }

  // Add pressure from weekly debt
  if (weeklyDebt > 10) pressure += 1
  if (weeklyDebt > 20) pressure += 1

  return Math.min(5, Math.round(pressure))
}

// Get message emoji prefix based on situation
export function getUrgencyEmoji(pace: PaceAnalysis, weeklyDebt: number): string {
  if (weeklyDebt > 20) return "🚨" // Weekly crisis
  if (pace.isCritical) return "🔴" // Critical behind
  if (pace.isUrgent) return "⚠️" // Urgent
  if (pace.isWarning) return "⏰" // Warning
  if (pace.isAhead) return "🚀" // Ahead of pace
  if (pace.isPerfect) return "✅" // On track
  return "📊" // Default
}

// Generate urgency message
export function generateUrgencyMessage(
  pace: PaceAnalysis,
  hour: number,
  dailyDebt: number,
  weeklyDebt: number
): string {
  const emoji = getUrgencyEmoji(pace, weeklyDebt)
  const timeStr = hour >= 12 ? `${hour > 12 ? hour - 12 : hour}pm` : `${hour}am`

  let msg = `${emoji} ${timeStr} Check-In\n\n`

  // Current status
  msg += `📊 Today: ${pace.currentPoints}/${DAILY_TARGET_POINTS} pts (${pace.percentOfDailyTarget}%)\n`
  msg += `⏱️ Expected by now: ${pace.expectedPoints.toFixed(1)} pts\n`

  // Pace analysis
  if (pace.isCritical) {
    msg += `\n🔴 CRITICAL: ${Math.abs(pace.delta).toFixed(1)} pts behind pace!\n`
    msg += `You need to ACCELERATE NOW to avoid disaster.\n`
  } else if (pace.isUrgent) {
    msg += `\n⚠️ URGENT: ${Math.abs(pace.delta).toFixed(1)} pts behind!\n`
    msg += `Time to buckle down and catch up.\n`
  } else if (pace.isWarning) {
    msg += `\n⏰ Slipping: ${Math.abs(pace.delta).toFixed(1)} pts behind pace\n`
    msg += `Pick up the pace to stay on track.\n`
  } else if (pace.isAhead) {
    msg += `\n🚀 Ahead by ${pace.delta.toFixed(1)} pts! Keep crushing it!\n`
  } else {
    msg += `\n✅ On pace - keep this momentum going!\n`
  }

  // Weekly debt consequences
  if (weeklyDebt > 0) {
    msg += `\n💳 Weekly Debt: ${weeklyDebt} pts\n`
    if (weeklyDebt > 20) {
      msg += `🚨 SEVERE WEEKLY DEFICIT - you're in crisis mode!\n`
    } else if (weeklyDebt > 10) {
      msg += `⚠️ Significant weekly deficit building up.\n`
    } else {
      msg += `⏰ Small deficit - still recoverable.\n`
    }
  }

  // Daily debt from previous days
  if (dailyDebt > 0 && weeklyDebt > dailyDebt) {
    const priorDebt = weeklyDebt - dailyDebt
    msg += `\n📉 Carrying ${priorDebt} pts debt from earlier this week\n`
  }

  // Action items based on time of day
  const remaining = DAILY_TARGET_POINTS - pace.currentPoints
  const remainingHours = 18 - hour
  const neededPerHour = remaining / remainingHours

  if (remaining > 0 && remainingHours > 0) {
    msg += `\n🎯 Need ${remaining.toFixed(1)} more pts in ${remainingHours}h\n`
    msg += `   → Avg ${neededPerHour.toFixed(1)} pts/hour needed\n`
  }

  // Hit minimum yet?
  if (pace.currentPoints < DAILY_MINIMUM_POINTS) {
    const toMin = DAILY_MINIMUM_POINTS - pace.currentPoints
    msg += `\n⚡ ${toMin.toFixed(1)} pts to hit daily MINIMUM\n`
  }

  return msg
}

// Calculate weekly debt from daily goals
export function calculateWeeklyDebt(weekDailyGoals: Array<{ earnedPoints: number; targetPoints: number }>): number {
  return weekDailyGoals.reduce((total, day) => {
    const dayDebt = Math.max(0, day.targetPoints - day.earnedPoints)
    return total + dayDebt
  }, 0)
}

// Determine if notification should be sent based on hour and pace
export function shouldSendUrgencyNotification(
  hour: number,
  pace: PaceAnalysis,
  lastNotificationHour: number | null
): boolean {
  // Don't send before work hours or after end of day
  if (hour < 10 || hour >= 18) return false

  // Don't send duplicate in same hour
  if (lastNotificationHour === hour) return false

  // Send at specific hours if behind pace
  const urgencyHours = [11, 12, 13, 14, 15, 17]

  if (urgencyHours.includes(hour)) {
    // Send if behind, warning, or critical
    return pace.isWarning || pace.isUrgent || pace.isCritical
  }

  // Send critical alerts any hour if severely behind
  if (pace.isCritical) return true

  return false
}

// Enhanced end-of-day summary with consequences
export function generateEndOfDaySummary(
  earnedPoints: number,
  targetPoints: number,
  taskCount: number,
  dailyDebt: number,
  weeklyDebt: number,
  dayOfWeek: string
): string {
  const percentOfTarget = Math.round((earnedPoints / targetPoints) * 100)
  const metMinimum = earnedPoints >= DAILY_MINIMUM_POINTS
  const metTarget = earnedPoints >= targetPoints

  // Grade calculation
  let grade = "F"
  let emoji = "💀"

  if (percentOfTarget >= 100) {
    grade = "S"
    emoji = "🏆"
  } else if (percentOfTarget >= 90) {
    grade = "A"
    emoji = "🌟"
  } else if (percentOfTarget >= 75) {
    grade = "B"
    emoji = "✅"
  } else if (percentOfTarget >= 67) {
    grade = "C"
    emoji = "⚠️"
  } else if (percentOfTarget >= 50) {
    grade = "D"
    emoji = "😰"
  }

  let msg = `${emoji} End of ${dayOfWeek}\n\n`
  msg += `📊 Day Grade: ${grade} (${percentOfTarget}%)\n`
  msg += `✓ ${taskCount} tasks • ${earnedPoints}/${targetPoints} pts\n\n`

  // Daily performance
  if (metTarget) {
    msg += `🎯 TARGET HIT! Excellent work today.\n`
  } else if (metMinimum) {
    msg += `✅ Minimum met, but missed target by ${dailyDebt} pts.\n`
  } else {
    msg += `❌ FAILED MINIMUM - ${dailyDebt} pts below target!\n`
  }

  // Daily debt consequence
  if (dailyDebt > 0) {
    msg += `\n💳 Today's Debt: ${dailyDebt} pts added to weekly total\n`
  } else if (earnedPoints > targetPoints) {
    const surplus = earnedPoints - targetPoints
    msg += `\n🌟 Surplus: +${surplus} pts above target!\n`
  }

  // Weekly debt status
  msg += `\n📈 Weekly Debt: ${weeklyDebt} pts total\n`

  if (weeklyDebt === 0) {
    msg += `✅ No debt - perfect week so far!\n`
  } else if (weeklyDebt > 20) {
    msg += `🚨 CRITICAL DEFICIT! You're in serious trouble.\n`
    msg += `Tomorrow must be EXCEPTIONAL to recover.\n`
  } else if (weeklyDebt > 10) {
    msg += `⚠️ Significant deficit building.\n`
    msg += `Tomorrow needs to be strong to stay on track.\n`
  } else {
    msg += `⏰ Small deficit - still recoverable.\n`
  }

  // Consequence for tomorrow
  if (dailyDebt > 0) {
    const tomorrowTarget = targetPoints + Math.ceil(dailyDebt / 2) // Need to make up half the debt
    msg += `\n🎯 Tomorrow's Adjusted Target: ${tomorrowTarget} pts\n`
    msg += `   (${targetPoints} normal + ${tomorrowTarget - targetPoints} debt recovery)\n`
  }

  return msg
}
