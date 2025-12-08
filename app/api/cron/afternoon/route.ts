import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VERCEL_URL
    const url = baseUrl?.startsWith("http") ? baseUrl : `https://${baseUrl}`

    const response = await fetch(`${url}/api/notifications/afternoon-summary`)
    const result = await response.json()

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Cron Afternoon] Error:", error)
    return NextResponse.json({ error: "Failed to run afternoon cron", details: String(error) }, { status: 500 })
  }
}
