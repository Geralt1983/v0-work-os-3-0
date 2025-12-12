import { NextResponse } from "next/server"

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000"
    const cronSecret = process.env.CRON_SECRET

    const response = await fetch(`${baseUrl}/api/notifications/morning-summary`, {
      method: "GET",
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
    })

    const data = await response.json()

    return NextResponse.json({
      status: response.status,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
