import { NextResponse } from "next/server"
import { generateAvoidanceReport } from "@/lib/ai/avoidance"

export async function GET() {
  try {
    const report = await generateAvoidanceReport()
    return NextResponse.json(report)
  } catch (err) {
    console.error("[api/avoidance] Error:", err)
    return NextResponse.json({ error: "Failed to generate avoidance report" }, { status: 500 })
  }
}
