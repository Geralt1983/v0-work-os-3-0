import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_PREFIXES = ["image/", "audio/"]
const ALLOWED_MIME_TYPES = new Set(["application/pdf"])

export const runtime = "nodejs"

function isAllowedMime(mime: string): boolean {
  if (!mime) {
    return false
  }
  if (ALLOWED_MIME_TYPES.has(mime)) {
    return true
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 })
    }

    if (!isAllowedMime(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    }

    const id = randomUUID()
    const originalName = file.name || "upload"
    const ext = path.extname(originalName)
    const storedName = ext ? `${id}${ext}` : id

    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await mkdir(uploadsDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadsDir, storedName), buffer)

    return NextResponse.json({
      id,
      url: `/uploads/${storedName}`,
      name: originalName,
      mime: file.type,
      size: file.size,
    })
  } catch (error) {
    console.error("[uploads] Failed to upload file:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
