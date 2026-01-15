import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { tasks, clients, dailyGoals } from "@/lib/schema"
import { eq, and, gte, ne, desc } from "drizzle-orm"
import { calculateMomentum } from "@/lib/metrics"
import { DAILY_MINIMUM_POINTS, DAILY_TARGET_POINTS, WORK_START_HOUR, WORK_END_HOUR } from "@/lib/constants"
import { getESTNow, getESTTodayStart, estToUTC } from "@/lib/domain"
import { calculateTotalPoints } from "@/lib/domain/task-types"
import { sendNotification } from "@/lib/notifications"

function getMomentumStatusEmoji(status: string): string {
    switch (status) {
        case "crushing":
            return "🔥"
        case "on_track":
            return "✅"
        case "behind":
            return "⚠️"
        case "stalled":
            return "🚨"
        default:
            return ""
    }
}

export async function POST() {
    try {
        const db = getDb()

        const now = new Date()
        const estNow = getESTNow(now)
        const todayUTC = estToUTC(getESTTodayStart(now), now)

        const completedToday = await db
            .select()
            .from(tasks)
            .where(and(eq(tasks.status, "done"), gte(tasks.completedAt, todayUTC)))

        // Calculate earned points
        const earnedPoints = calculateTotalPoints(completedToday)
        const targetPoints = DAILY_TARGET_POINTS

        const percentOfTarget = Math.round((earnedPoints / targetPoints) * 100)
        const momentum = calculateMomentum(earnedPoints)

        let paceStatus: "ahead" | "on_track" | "behind" | "minimum_only"
        if (percentOfTarget >= 100) {
            paceStatus = "ahead"
        } else if (earnedPoints >= DAILY_MINIMUM_POINTS) {
            paceStatus = "minimum_only"
        } else if (earnedPoints === 0) {
            paceStatus = "behind"
        } else {
            const estHour = estNow.getHours() + estNow.getMinutes() / 60
            const dayProgress = Math.max(0, Math.min(100, ((estHour - WORK_START_HOUR) / (WORK_END_HOUR - WORK_START_HOUR)) * 100))
            paceStatus = percentOfTarget >= dayProgress ? "on_track" : "behind"
        }

        // Format message
        let msg = `📊 Status Update\n\n`
        msg += `Points: ${earnedPoints}/${targetPoints} (${percentOfTarget}%)\n`
        msg += `Tasks: ${completedToday.length} completed\n`

        // Momentum
        const momentumEmoji = getMomentumStatusEmoji(momentum.status)
        msg += `Momentum: ${momentumEmoji} ${momentum.percent} (${momentum.status.replace("_", " ")})\n`

        // Pace
        let paceEmoji = "⚠️"
        if (paceStatus === "ahead") paceEmoji = "🚀"
        else if (paceStatus === "on_track") paceEmoji = "✅"
        else if (paceStatus === "minimum_only") paceEmoji = "🆗"

        msg += `Pace: ${paceEmoji} ${paceStatus.replace("_", " ")}\n`

        // Send notification
        const result = await sendNotification(msg, {
            title: "Current Status",
            tags: "chart_with_upwards_trend",
        })

        return NextResponse.json({ success: true, message: msg, result })
    } catch (error) {
        console.error("Failed to send status notification:", error)
        return NextResponse.json({ error: "Failed to send status notification", details: String(error) }, { status: 500 })
    }
}
