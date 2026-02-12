// =============================================================================
// TIMEZONE UTILITIES
// Centralized America/New_York (EST/EDT) handling, DST-aware.
//
// Notes on representation:
// - Functions like getESTNow()/getESTTodayStart() return a "zoned wall-clock"
//   Date where the *UTC fields* (getUTC*) reflect the New York local time.
//   This matches existing usage patterns in this codebase (date strings via
//   toISOString(), and later conversion to real UTC instants for DB queries).
// =============================================================================

export const NY_TZ = "America/New_York"

export type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

export function toYyyyMmDd(parts: Pick<ZonedParts, "year" | "month" | "day">): string {
  const mm = String(parts.month).padStart(2, "0")
  const dd = String(parts.day).padStart(2, "0")
  return `${parts.year}-${mm}-${dd}`
}

// Convert a wall-clock time in a specific zone into a UTC Date (DST-aware).
export function zonedTimeToUtcDate(
  timeZone: string,
  desired: Omit<ZonedParts, "minute" | "second"> & Partial<Pick<ZonedParts, "minute" | "second">>,
): Date {
  const minute = desired.minute ?? 0
  const second = desired.second ?? 0

  // Start with a naive UTC construction; then iteratively correct based on the
  // time-zone formatted parts until the zone's wall-clock matches the desired parts.
  let utc = new Date(Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, minute, second))
  const desiredUtcLike = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, minute, second)

  for (let i = 0; i < 3; i++) {
    const current = getZonedParts(utc, timeZone)
    const currentUtcLike = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second,
    )
    const deltaMs = desiredUtcLike - currentUtcLike
    if (deltaMs === 0) break
    utc = new Date(utc.getTime() + deltaMs)
  }

  return utc
}

/**
 * Get current time in "EST" (really America/New_York, DST-aware) as a wall-clock Date.
 * The returned Date's UTC fields represent the New York local time.
 */
export function getESTNow(now = new Date()): Date {
  const ny = getZonedParts(now, NY_TZ)
  return new Date(Date.UTC(ny.year, ny.month - 1, ny.day, ny.hour, ny.minute, ny.second))
}

/**
 * Get start of today in New York as a wall-clock Date.
 */
export function getESTTodayStart(now = new Date()): Date {
  const estNow = getESTNow(now)
  estNow.setUTCHours(0, 0, 0, 0)
  return estNow
}

/**
 * Get end of today in New York as a wall-clock Date.
 */
export function getESTTodayEnd(now = new Date()): Date {
  const estNow = getESTNow(now)
  estNow.setUTCHours(23, 59, 59, 999)
  return estNow
}

/**
 * Get start of current week (Monday) in New York as a wall-clock Date.
 */
export function getESTWeekStart(now = new Date()): Date {
  const estNow = getESTNow(now)
  const day = estNow.getUTCDay()
  const diff = estNow.getUTCDate() - day + (day === 0 ? -6 : 1) // Monday
  estNow.setUTCDate(diff)
  estNow.setUTCHours(0, 0, 0, 0)
  return estNow
}

/**
 * Get end of current week (Sunday) in New York as a wall-clock Date.
 */
export function getESTWeekEnd(now = new Date()): Date {
  const weekStart = getESTWeekStart(now)
  weekStart.setUTCDate(weekStart.getUTCDate() + 6)
  weekStart.setUTCHours(23, 59, 59, 999)
  return weekStart
}

/**
 * Convert a New York wall-clock Date into a real UTC Date for DB queries.
 */
export function estToUTC(estDate: Date): Date {
  return zonedTimeToUtcDate(NY_TZ, {
    year: estDate.getUTCFullYear(),
    month: estDate.getUTCMonth() + 1,
    day: estDate.getUTCDate(),
    hour: estDate.getUTCHours(),
    minute: estDate.getUTCMinutes(),
    second: estDate.getUTCSeconds(),
  })
}

/**
 * Get today's date range in UTC for database queries.
 * Returns [startUTC, endUTC] tuple.
 */
export function getTodayUTCRange(now = new Date()): [Date, Date] {
  const todayStart = getESTTodayStart(now)
  const todayEnd = getESTTodayEnd(now)
  return [estToUTC(todayStart), estToUTC(todayEnd)]
}

/**
 * Get current week's date range in UTC for database queries.
 * Returns [startUTC, endUTC] tuple.
 */
export function getWeekUTCRange(now = new Date()): [Date, Date] {
  const weekStart = getESTWeekStart(now)
  const weekEnd = getESTWeekEnd(now)
  return [estToUTC(weekStart), estToUTC(weekEnd)]
}

/**
 * Get New York date string in YYYY-MM-DD format.
 */
export function getESTDateString(now = new Date()): string {
  return toYyyyMmDd(getZonedParts(now, NY_TZ))
}

/**
 * Get New York hour (0-23).
 */
export function getESTHour(now = new Date()): number {
  return getZonedParts(now, NY_TZ).hour
}

/**
 * Get New York day of week (0 = Sunday, 1 = Monday, etc).
 */
export function getESTDayOfWeek(now = new Date()): number {
  // Use a stable mapping that doesn't depend on server timezone.
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: NY_TZ, weekday: "short" }).format(now)
  switch (weekday) {
    case "Sun":
      return 0
    case "Mon":
      return 1
    case "Tue":
      return 2
    case "Wed":
      return 3
    case "Thu":
      return 4
    case "Fri":
      return 5
    case "Sat":
      return 6
    default:
      // Fallback: derive from wall-clock Date if Intl returns unexpected output.
      return getESTNow(now).getUTCDay()
  }
}

/**
 * Get number of work days passed this week (0-5, Mon-Fri).
 */
export function getWorkDaysPassed(now = new Date()): number {
  const dayOfWeek = getESTDayOfWeek(now) || 7 // Convert Sunday (0) to 7
  return Math.min(dayOfWeek - 1, 5)
}
