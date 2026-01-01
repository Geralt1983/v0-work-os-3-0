// Daily goal constants (points-based, not time-based)
export const DAILY_MINIMUM_POINTS = 12 // Minimum daily points
export const DAILY_TARGET_POINTS = 16 // Ideal daily goal (matches lib/domain/task-types.ts)

// Stale wall configuration
export const STALE_THRESHOLD_DAYS = 5 // Days without activity before client is considered "stale"
export const BLOCKER_SKIP_THRESHOLD = 3 // Consecutive skips before asking "what's blocking?"

// Weekly goals (points-based)
export const WEEKLY_MINIMUM_POINTS = 60 // 5 workdays × 12 minimum
export const WEEKLY_TARGET_POINTS = 80 // 5 workdays × 16 target

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
