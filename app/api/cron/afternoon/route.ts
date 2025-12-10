import { NextResponse } from "next/server"

export async function GET(request: Request) {
  console.log("[Cron Afternoon] Starting at", new Date().toISOString())

  const isVercelCron = request.headers.get("x-vercel-cron") === "true"
  const authHeader = request.headers.get("authorization")
  const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`

  console.log("[Cron Afternoon] isVercelCron:", isVercelCron, "isAuthorized:", isAuthorized)

  if (!isVercelCron && !isAuthorized) {
    console.log("[Cron Afternoon] Unauthorized - not a Vercel cron and invalid CRON_SECRET")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VERCEL_URL
    const url = baseUrl?.startsWith("http") ? baseUrl : `https://${baseUrl}`

    console.log("[Cron Afternoon] Running daily snapshot...")
    try {
      const snapshotResponse = await fetch(`${url}/api/cron/snapshot`)
      const snapshotResult = await snapshotResponse.json()
      console.log("[Cron Afternoon] Snapshot result:", snapshotResult)
    } catch (snapshotError) {
      console.error("[Cron Afternoon] Snapshot error (continuing):", snapshotError)
    }

    // Send afternoon summary notification
    console.log("[Cron Afternoon] Sending afternoon summary...")
    const response = await fetch(`${url}/api/notifications/afternoon-summary`)
    const result = await response.json()

    console.log("[Cron Afternoon] Result:", result)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[Cron Afternoon] Error:", error)
    return NextResponse.json({ error: "Failed to run afternoon cron", details: String(error) }, { status: 500 })
  }
}
