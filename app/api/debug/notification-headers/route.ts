import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const rawToken = process.env.NTFY_ACCESS_TOKEN

  if (!rawToken) {
    return NextResponse.json({ error: "No token configured" }, { status: 500 })
  }

  const cleanToken = rawToken.trim().replace(/['"]/g, "")

  // Analyze the raw token for issues
  const analysis = {
    raw: {
      length: rawToken.length,
      firstCharCode: rawToken.charCodeAt(0),
      lastCharCode: rawToken.charCodeAt(rawToken.length - 1),
      hasLeadingSpace: rawToken !== rawToken.trimStart(),
      hasTrailingSpace: rawToken !== rawToken.trimEnd(),
      hasQuotes: rawToken.includes('"') || rawToken.includes("'"),
      preview: rawToken.substring(0, 10) + "...",
    },
    clean: {
      length: cleanToken.length,
      preview: cleanToken.substring(0, 10) + "...",
      startsWithTk: cleanToken.startsWith("tk_"),
    },
    authHeader: `Bearer ${cleanToken.substring(0, 15)}...`,
    expectedLength: 31, // tk_ + 28 chars typical
    url: "https://ntfy.sh/Jeremys-Impressive-Work-Updates",
  }

  return NextResponse.json(analysis)
}
