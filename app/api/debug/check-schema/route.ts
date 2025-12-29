import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sql } from "drizzle-orm"

export async function GET() {
  try {
    const db = await getDb()

    // Check what columns exist in daily_goals
    const columns = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'daily_goals'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      success: true,
      columns: columns.rows,
      database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export const maxDuration = 60
