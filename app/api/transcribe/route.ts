import { NextResponse } from "next/server"
import OpenAI from "openai"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const isPreview =
      !process.env.OPENAI_API_KEY ||
      process.env.VERCEL_ENV === "preview" ||
      request.headers.get("host")?.includes("vusercontent.net")

    console.log("[v0] Transcribe API called:", {
      isPreview,
      hasApiKey: !!process.env.OPENAI_API_KEY,
      host: request.headers.get("host"),
    })

    if (isPreview) {
      console.log("[v0] Transcribe: Using mock transcription in preview")
      return NextResponse.json({
        text: "This is a mock transcription for preview environment. Voice recording works!",
        success: true,
        mock: true,
      })
    }

    const formData = await request.formData()
    const audioFile = formData.get("audio") as Blob | null

    if (!audioFile) {
      console.error("[v0] Transcribe: No audio file in request")
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Convert Blob to File for OpenAI API
    const file = new File([audioFile], "recording.webm", {
      type: audioFile.type || "audio/webm",
    })

    console.log("[v0] Transcribe: Processing audio file:", {
      size: file.size,
      type: file.type,
    })

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "en",
      response_format: "text",
      prompt:
        "This is a task management voice note. Common terms include: Raleigh, Orlando, Memphis, Kentucky, Epic, ClinDoc, Bridges, move, task, client, pipeline, backlog, queued, active, done, momentum, triage.",
    })

    console.log("[v0] Transcribe: Success:", {
      length: transcription.length,
      preview: transcription.substring(0, 100),
    })

    return NextResponse.json({
      text: transcription,
      success: true,
    })
  } catch (error) {
    console.error("[v0] Transcribe: Error details:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })

    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (error.message.includes("Invalid file format")) {
        return NextResponse.json({ error: "Invalid audio format. Please try again." }, { status: 400 })
      }

      if (error.message.includes("rate_limit")) {
        return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 })
      }

      // Return the actual error message for debugging
      return NextResponse.json(
        {
          error: `Transcription error: ${error.message}`,
          details: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 })
  }
}
