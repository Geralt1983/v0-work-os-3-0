import { NextResponse } from "next/server"
import { checkAndSendMilestone } from "@/lib/milestone-checker"

export async function POST() {
  // const result = await checkAndSendMilestone()
  return NextResponse.json({ message: "Milestone notifications disabled" })
}
