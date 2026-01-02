import { NextResponse } from "next/server"
import {
  getAllHolidays,
  addHoliday,
  isTodayHoliday,
  getTodayHolidayInfo,
} from "@/lib/holidays"

export async function GET() {
  try {
    const [holidaysList, isToday, todayInfo] = await Promise.all([
      getAllHolidays(),
      isTodayHoliday(),
      getTodayHolidayInfo(),
    ])

    return NextResponse.json({
      holidays: holidaysList,
      isTodayHoliday: isToday,
      todayHolidayInfo: todayInfo,
    })
  } catch (error) {
    console.error("Failed to get holidays:", error)
    return NextResponse.json(
      { error: "Failed to get holidays" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, description } = body

    if (!date) {
      return NextResponse.json(
        { error: "Date is required" },
        { status: 400 }
      )
    }

    const holiday = await addHoliday(new Date(date), description)

    return NextResponse.json(holiday)
  } catch (error) {
    console.error("Failed to add holiday:", error)
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { error: "This date is already marked as a holiday" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: "Failed to add holiday" },
      { status: 500 }
    )
  }
}
