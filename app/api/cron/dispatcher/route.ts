import { NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET
  
  if (!expectedToken) return true
  if (!authHeader) return false
  
  const token = authHeader.replace('Bearer ', '')
  return token === expectedToken
}

// Check if we're in Daylight Saving Time (US Eastern)
function isEDT(date: Date): boolean {
  // EDT runs from 2nd Sunday of March to 1st Sunday of November
  const year = date.getUTCFullYear()
  
  // Find 2nd Sunday of March
  const marchFirst = new Date(Date.UTC(year, 2, 1)) // March 1
  const marchFirstDay = marchFirst.getUTCDay()
  const secondSundayMarch = 8 + (7 - marchFirstDay) % 7 // 8-14th
  const edtStart = new Date(Date.UTC(year, 2, secondSundayMarch, 7)) // 2am EST = 7am UTC
  
  // Find 1st Sunday of November
  const novFirst = new Date(Date.UTC(year, 10, 1)) // November 1
  const novFirstDay = novFirst.getUTCDay()
  const firstSundayNov = 1 + (7 - novFirstDay) % 7 // 1-7th
  const edtEnd = new Date(Date.UTC(year, 10, firstSundayNov, 6)) // 2am EDT = 6am UTC
  
  return date >= edtStart && date < edtEnd
}

// Get current time in US Eastern
function getEasternTime(date: Date): { hour: number; minute: number; dayOfWeek: number; dateStr: string } {
  const isDST = isEDT(date)
  const offsetHours = isDST ? -4 : -5 // EDT = UTC-4, EST = UTC-5
  
  const eastern = new Date(date.getTime() + offsetHours * 60 * 60 * 1000)
  
  return {
    hour: eastern.getUTCHours(),
    minute: eastern.getUTCMinutes(),
    dayOfWeek: eastern.getUTCDay(), // 0 = Sunday, 1 = Monday, etc.
    dateStr: eastern.toISOString().split('T')[0],
  }
}

// Notification schedule (in Eastern Time)
interface ScheduledNotification {
  hour: number
  name: string
  endpoint: string
  weekdaysOnly: boolean
  sundayOnly?: boolean
}

const SCHEDULE: ScheduledNotification[] = [
  { hour: 8, name: 'Morning Summary', endpoint: '/api/notifications/morning-summary', weekdaysOnly: true },
  { hour: 10, name: 'Started Check', endpoint: '/api/notifications/started-check', weekdaysOnly: true },
  { hour: 16, name: 'Afternoon Summary', endpoint: '/api/notifications/afternoon-summary', weekdaysOnly: true },
  { hour: 18, name: 'End of Day', endpoint: '/api/notifications/end-of-day', weekdaysOnly: true },
  { hour: 18, name: 'Weekly Review', endpoint: '/api/notifications/weekly-backlog-review', weekdaysOnly: false, sundayOnly: true },
]

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const eastern = getEasternTime(now)
    const isDST = isEDT(now)
    
    console.log(`[DISPATCHER] Current Eastern Time: ${eastern.hour}:${eastern.minute.toString().padStart(2, '0')} (${isDST ? 'EDT' : 'EST'})`)
    console.log(`[DISPATCHER] Day of week: ${eastern.dayOfWeek} (0=Sun, 1=Mon, ...)`)
    
    // Find matching notifications for this hour
    const isWeekday = eastern.dayOfWeek >= 1 && eastern.dayOfWeek <= 5
    const isSunday = eastern.dayOfWeek === 0
    
    const matching = SCHEDULE.filter(notif => {
      // Check hour match
      if (notif.hour !== eastern.hour) return false
      
      // Check day restrictions
      if (notif.sundayOnly && !isSunday) return false
      if (notif.weekdaysOnly && !isWeekday) return false
      
      return true
    })
    
    if (matching.length === 0) {
      console.log(`[DISPATCHER] No notifications scheduled for ${eastern.hour}:00 Eastern`)
      return NextResponse.json({ 
        dispatched: false, 
        reason: 'No notifications scheduled for this hour',
        easternTime: `${eastern.hour}:${eastern.minute.toString().padStart(2, '0')}`,
        isDST,
        dayOfWeek: eastern.dayOfWeek,
      })
    }
    
    // Dispatch each matching notification
    const results = []
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://v0-work-os-main.vercel.app'
    
    for (const notif of matching) {
      console.log(`[DISPATCHER] Triggering: ${notif.name}`)
      
      try {
        const response = await fetch(`${baseUrl}${notif.endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
        })
        
        const data = await response.json().catch(() => ({}))
        
        results.push({
          name: notif.name,
          endpoint: notif.endpoint,
          status: response.status,
          success: response.ok,
          data,
        })
        
        console.log(`[DISPATCHER] ${notif.name}: ${response.status}`)
      } catch (error) {
        console.error(`[DISPATCHER] ${notif.name} failed:`, error)
        results.push({
          name: notif.name,
          endpoint: notif.endpoint,
          status: 500,
          success: false,
          error: String(error),
        })
      }
    }
    
    return NextResponse.json({
      dispatched: true,
      easternTime: `${eastern.hour}:${eastern.minute.toString().padStart(2, '0')}`,
      isDST,
      dayOfWeek: eastern.dayOfWeek,
      results,
    })
    
  } catch (error) {
    console.error('[DISPATCHER] Failed:', error)
    return NextResponse.json({ error: 'Dispatcher failed' }, { status: 500 })
  }
}

// GET for easy testing in browser
export async function GET(request: Request) {
  // Just show current Eastern time and what would be dispatched
  const now = new Date()
  const eastern = getEasternTime(now)
  const isDST = isEDT(now)
  
  const isWeekday = eastern.dayOfWeek >= 1 && eastern.dayOfWeek <= 5
  const isSunday = eastern.dayOfWeek === 0
  
  const scheduled = SCHEDULE.map(notif => {
    let wouldFire = notif.hour === eastern.hour
    if (notif.sundayOnly && !isSunday) wouldFire = false
    if (notif.weekdaysOnly && !isWeekday) wouldFire = false
    
    return {
      ...notif,
      wouldFireNow: wouldFire,
    }
  })
  
  return NextResponse.json({
    currentEasternTime: `${eastern.hour}:${eastern.minute.toString().padStart(2, '0')}`,
    isDST,
    timezone: isDST ? 'EDT (UTC-4)' : 'EST (UTC-5)',
    dayOfWeek: eastern.dayOfWeek,
    dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][eastern.dayOfWeek],
    isWeekday,
    schedule: scheduled,
  })
}
