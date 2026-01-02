import { NextResponse } from "next/server"
import { removeHoliday } from "@/lib/holidays"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const holidayId = parseInt(id, 10)

    if (isNaN(holidayId)) {
      return NextResponse.json(
        { error: "Invalid holiday ID" },
        { status: 400 }
      )
    }

    await removeHoliday(holidayId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete holiday:", error)
    return NextResponse.json(
      { error: "Failed to delete holiday" },
      { status: 500 }
    )
  }
}
