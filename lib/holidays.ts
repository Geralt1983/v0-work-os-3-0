// =============================================================================
// HOLIDAY MANAGEMENT
// Track holidays and exclude them from staleness/daily goal calculations
// =============================================================================

import { getDb } from "@/lib/db"
import { holidays } from "@/lib/schema"
import { eq, gte, lte, and, desc } from "drizzle-orm"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface HolidayInfo {
  id: number
  date: string
  description: string | null
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

/**
 * Check if a specific date is marked as a holiday
 */
export async function isHoliday(date: Date): Promise<boolean> {
  const db = getDb()
  const dateStr = formatDateString(date)

  const [holiday] = await db
    .select()
    .from(holidays)
    .where(eq(holidays.date, dateStr))
    .limit(1)

  return !!holiday
}

/**
 * Check if today is a holiday
 */
export async function isTodayHoliday(): Promise<boolean> {
  return isHoliday(new Date())
}

/**
 * Get holiday info for today (if it is a holiday)
 */
export async function getTodayHolidayInfo(): Promise<HolidayInfo | null> {
  const db = getDb()
  const dateStr = formatDateString(new Date())

  const [holiday] = await db
    .select()
    .from(holidays)
    .where(eq(holidays.date, dateStr))
    .limit(1)

  if (!holiday) return null

  return {
    id: holiday.id,
    date: holiday.date,
    description: holiday.description,
  }
}

/**
 * Count holidays between two dates (inclusive)
 * Used to adjust staleness calculations
 */
export async function countHolidaysBetween(startDate: Date, endDate: Date): Promise<number> {
  const db = getDb()
  const startStr = formatDateString(startDate)
  const endStr = formatDateString(endDate)

  const holidayList = await db
    .select()
    .from(holidays)
    .where(and(
      gte(holidays.date, startStr),
      lte(holidays.date, endStr)
    ))

  return holidayList.length
}

/**
 * Get all holidays (ordered by date descending)
 */
export async function getAllHolidays(): Promise<HolidayInfo[]> {
  const db = getDb()

  const holidayList = await db
    .select()
    .from(holidays)
    .orderBy(desc(holidays.date))

  return holidayList.map(h => ({
    id: h.id,
    date: h.date,
    description: h.description,
  }))
}

/**
 * Get upcoming holidays (from today forward)
 */
export async function getUpcomingHolidays(limit = 10): Promise<HolidayInfo[]> {
  const db = getDb()
  const todayStr = formatDateString(new Date())

  const holidayList = await db
    .select()
    .from(holidays)
    .where(gte(holidays.date, todayStr))
    .orderBy(holidays.date)
    .limit(limit)

  return holidayList.map(h => ({
    id: h.id,
    date: h.date,
    description: h.description,
  }))
}

/**
 * Add a holiday
 */
export async function addHoliday(date: Date, description?: string): Promise<HolidayInfo> {
  const db = getDb()
  const dateStr = formatDateString(date)

  const [inserted] = await db
    .insert(holidays)
    .values({
      date: dateStr,
      description: description || null,
    })
    .returning()

  return {
    id: inserted.id,
    date: inserted.date,
    description: inserted.description,
  }
}

/**
 * Remove a holiday by ID
 */
export async function removeHoliday(id: number): Promise<void> {
  const db = getDb()
  await db.delete(holidays).where(eq(holidays.id, id))
}

/**
 * Remove a holiday by date
 */
export async function removeHolidayByDate(date: Date): Promise<void> {
  const db = getDb()
  const dateStr = formatDateString(date)
  await db.delete(holidays).where(eq(holidays.date, dateStr))
}

/**
 * Calculate adjusted staleness days (excluding holidays)
 * Takes actual calendar days and subtracts holidays in that period
 */
export async function getAdjustedStaleDays(
  lastActivityDate: Date,
  currentDate: Date = new Date()
): Promise<number> {
  const diffMs = currentDate.getTime() - lastActivityDate.getTime()
  const calendarDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (calendarDays <= 0) return 0

  const holidayCount = await countHolidaysBetween(lastActivityDate, currentDate)

  // Subtract holidays from the count, but never go below 0
  return Math.max(0, calendarDays - holidayCount)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Format a date as YYYY-MM-DD string (for database storage)
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD string back to a Date
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}
