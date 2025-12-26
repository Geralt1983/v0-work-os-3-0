// =============================================================================
// TIMEZONE UTILITIES
// Centralized EST/EDT timezone handling
// =============================================================================

/** EST offset in minutes from UTC */
const EST_OFFSET_MINUTES = -5 * 60

/**
 * Get current time in EST timezone
 */
export function getESTNow(now = new Date()): Date {
  const utcOffset = now.getTimezoneOffset()
  return new Date(now.getTime() + (utcOffset + EST_OFFSET_MINUTES) * 60 * 1000)
}

/**
 * Get start of today in EST timezone
 */
export function getESTTodayStart(now = new Date()): Date {
  const estNow = getESTNow(now)
  estNow.setHours(0, 0, 0, 0)
  return estNow
}

/**
 * Get end of today in EST timezone
 */
export function getESTTodayEnd(now = new Date()): Date {
  const estNow = getESTNow(now)
  estNow.setHours(23, 59, 59, 999)
  return estNow
}

/**
 * Get start of current week (Monday) in EST timezone
 */
export function getESTWeekStart(now = new Date()): Date {
  const estNow = getESTNow(now)
  const day = estNow.getDay()
  const diff = estNow.getDate() - day + (day === 0 ? -6 : 1) // Monday
  estNow.setDate(diff)
  estNow.setHours(0, 0, 0, 0)
  return estNow
}

/**
 * Get end of current week (Sunday) in EST timezone
 */
export function getESTWeekEnd(now = new Date()): Date {
  const weekStart = getESTWeekStart(now)
  weekStart.setDate(weekStart.getDate() + 6)
  weekStart.setHours(23, 59, 59, 999)
  return weekStart
}

/**
 * Convert EST date to UTC for database queries
 */
export function estToUTC(estDate: Date, now = new Date()): Date {
  const utcOffset = now.getTimezoneOffset()
  return new Date(estDate.getTime() - (utcOffset + EST_OFFSET_MINUTES) * 60 * 1000)
}

/**
 * Get today's date range in UTC for database queries
 * Returns [startUTC, endUTC] tuple
 */
export function getTodayUTCRange(now = new Date()): [Date, Date] {
  const todayStart = getESTTodayStart(now)
  const todayEnd = getESTTodayEnd(now)
  return [estToUTC(todayStart, now), estToUTC(todayEnd, now)]
}

/**
 * Get current week's date range in UTC for database queries
 * Returns [startUTC, endUTC] tuple
 */
export function getWeekUTCRange(now = new Date()): [Date, Date] {
  const weekStart = getESTWeekStart(now)
  const weekEnd = getESTWeekEnd(now)
  return [estToUTC(weekStart, now), estToUTC(weekEnd, now)]
}

/**
 * Get EST date string in YYYY-MM-DD format
 */
export function getESTDateString(now = new Date()): string {
  const estNow = getESTNow(now)
  return estNow.toISOString().split("T")[0]
}

/**
 * Get EST hour (0-23)
 */
export function getESTHour(now = new Date()): number {
  return getESTNow(now).getHours()
}

/**
 * Get EST day of week (0 = Sunday, 1 = Monday, etc.)
 */
export function getESTDayOfWeek(now = new Date()): number {
  return getESTNow(now).getDay()
}

/**
 * Get number of work days passed this week (0-5, Mon-Fri)
 */
export function getWorkDaysPassed(now = new Date()): number {
  const dayOfWeek = getESTDayOfWeek(now) || 7 // Convert Sunday (0) to 7
  return Math.min(dayOfWeek - 1, 5) // 0-5 work days passed
}
