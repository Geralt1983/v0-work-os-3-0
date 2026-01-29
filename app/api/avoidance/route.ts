import { NextResponse } from "next/server"
import { generateAvoidanceReport } from "@/lib/ai/avoidance"
import { isPreviewWithoutDb } from "@/lib/db"

export async function GET() {
  try {
    // Return mock data in preview mode without database
    if (isPreviewWithoutDb()) {
      console.log("[v0] Avoidance API: Using mock data (preview mode)")
      return NextResponse.json({
        staleClients: [],
        avoidedClients: [],
        summary: "Preview mode - no avoidance data available",
      })
    }
    
    const report = await generateAvoidanceReport()
    return NextResponse.json(report)
  } catch (err) {
    console.error("[api/avoidance] Error:", err)
    return NextResponse.json({ error: "Failed to generate avoidance report" }, { status: 500 })
  }
}
