export const maxDuration = 120

import { NextResponse } from "next/server"

export async function GET(request: Request) {
  console.log("[Cron Morning] Starting at", new Date().toISOString())

  const vercelCronHeader = request.headers.get("x-vercel-cron")
  const isVercelCron = vercelCronHeader === "1" || vercelCronHeader === "true"
  const authHeader = request.headers.get("authorization")
  const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`

  console.log(
    "[Cron Morning] x-vercel-cron header:",
    vercelCronHeader,
    "isVercelCron:",
    isVercelCron,
    "isAuthorized:",
    isAuthorized,
  )

  if (!isVercelCron && !isAuthorized) {
    console.log("[Cron Morning] Unauthorized - not a Vercel cron and invalid CRON_SECRET")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VERCEL_URL
    const url = baseUrl?.startsWith("http") ? baseUrl : `https://${baseUrl}`

    console.log("[Cron Morning] Running daily snapshot first")
    try {
      await fetch(`${url}/api/cron/snapshot`)
    } catch (e) {
      console.log("[Cron Morning] Snapshot error (non-fatal):", e)
    }

    console.log("[Cron Morning] Calling:", `${url}/api/notifications/morning-summary`)

    const response = await fetch(`${url}/api/notifications/morning-summary`)
    const result = await response.json()

    console.log("[Cron Morning] Result:", result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Cron Morning] Error:", error)
    return NextResponse.json({ error: "Failed to run morning cron", details: String(error) }, { status: 500 })
  }
}
