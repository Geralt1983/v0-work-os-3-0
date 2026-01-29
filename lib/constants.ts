// Daily goal constants (points-based, not time-based)
export const DAILY_MINIMUM_POINTS = 12 // Minimum daily points
export const DAILY_TARGET_POINTS = 18 // Ideal daily goal (matches lib/domain/task-types.ts)

// Weekly goals (points-based)
export const WEEKLY_MINIMUM_POINTS = 60 // 5 workdays × 12 minimum
export const WEEKLY_TARGET_POINTS = 90 // 5 workdays × 18 target

// Work hours (EST) - for momentum calculations
export const WORK_START_HOUR = 9 // 9 AM EST
export const WORK_END_HOUR = 18 // 6 PM EST

// Milestone percentages (based on TARGET points)
export const MILESTONES = [25, 50, 75, 100, 125, 150] as const

// Legacy constants for backwards compatibility (deprecated)
/** @deprecated Use DAILY_MINIMUM_POINTS instead */
export const DAILY_MINIMUM_MINUTES = 180
/** @deprecated Use DAILY_TARGET_POINTS instead */
export const DAILY_TARGET_MINUTES = 240
/** @deprecated Use WEEKLY_MINIMUM_POINTS instead */
export const WEEKLY_MINIMUM_MINUTES = 900
/** @deprecated Use WEEKLY_TARGET_POINTS instead */
export const WEEKLY_TARGET_MINUTES = 1200
