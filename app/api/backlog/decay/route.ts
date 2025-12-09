import { NextResponse } from "next/server"
import { getAgingReport, runAutoDecay } from "@/lib/backlog-decay"

// GET - Get aging report
export async function GET() {
  try {
    const report = await getAgingReport()
    return NextResponse.json(report)
  } catch (error) {
    console.error("Failed to get aging report:", error)
    return NextResponse.json({ error: "Failed to get aging report" }, { status: 500 })
  }
}

// POST - Run auto-decay manually
export async function POST() {
  try {
    const result = await runAutoDecay()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Auto-decay failed:", error)
    return NextResponse.json({ error: "Auto-decay failed" }, { status: 500 })
  }
}
