"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Mic, Send, X, Loader } from "lucide-react"
import { cn } from "@/lib/utils"

type RecordingState = "idle" | "recording" | "processing"

interface VoiceRecorderProps {
  onTranscription: (text: string) => void
  onError?: (error: string) => void
  disabled?: boolean
  compact?: boolean
  className?: string
}

export function VoiceRecorder({
  onTranscription,
  onError,
  disabled = false,
  compact = false,
  className,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle")
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [waveformData, setWaveformData] = useState<number[]>(new Array(32).fill(0))

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const durationIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length
    setAudioLevel(average / 255)

    const step = Math.floor(dataArray.length / 32)
    const waveform = Array.from({ length: 32 }, (_, i) => {
      const idx = i * step
      return dataArray[idx] / 255
    })
    setWaveformData(waveform)

    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      })

      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyzeAudio()

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(100)
      setState("recording")
      setDuration(0)

      durationIntervalRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (err) {
      onError?.("Microphone access denied")
    }
  }, [analyzeAudio, onError])

  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    setAudioLevel(0)
    setWaveformData(new Array(32).fill(0))
  }, [])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
    }
    stopRecording()
    setState("idle")
    setDuration(0)
    chunksRef.current = []
  }, [state, stopRecording])

  const sendRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || state !== "recording") return

    setState("processing")

    mediaRecorderRef.current.onstop = async () => {
      stopRecording()

      try {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" })

        console.log("[v0] Voice recorder: Sending audio for transcription", {
          size: audioBlob.size,
          type: audioBlob.type,
          duration: duration,
        })

        const formData = new FormData()
        formData.append("audio", audioBlob)

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          console.error("[v0] Voice recorder: Transcription failed", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          })
          throw new Error(errorData.error || errorData.details || "Transcription failed")
        }

        const data = await response.json()
        console.log("[v0] Voice recorder: Transcription success", {
          textLength: data.text?.length,
          isMock: data.mock,
        })

        onTranscription(data.text)
        setState("idle")
        setDuration(0)
      } catch (error) {
        console.error("[v0] Voice recorder: Error in sendRecording", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to transcribe audio"
        onError?.(errorMessage)
        setState("idle")
        setDuration(0)
      }
    }

    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
  }, [state, duration, stopRecording, onTranscription, onError])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (state === "idle") {
    return (
      <button
        onClick={startRecording}
        disabled={disabled}
        type="button"
        className={cn(
          "group relative flex items-center justify-center rounded-full",
          "bg-gradient-to-br from-zinc-800 to-zinc-900",
          "border border-zinc-700/50",
          "shadow-lg shadow-black/20",
          "transition-all duration-300 ease-out",
          "hover:scale-105 hover:shadow-xl hover:shadow-[0_0_16px_rgba(168,85,247,0.18)]",
          "hover:border-[color:var(--thanos-amethyst)]/30",
          "active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          compact ? "w-10 h-10" : "w-12 h-12",
          className,
        )}
      >
        <div className="absolute inset-0 rounded-full bg-[color:var(--thanos-amethyst)]/20 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
        <Mic
          className={cn(
            "relative transition-colors duration-200",
            "text-zinc-400 group-hover:text-[color:var(--thanos-amethyst)]",
            compact ? "w-4 h-4" : "w-5 h-5",
          )}
        />
      </button>
    )
  }

  if (state === "processing") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2",
          "bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900",
          "border border-zinc-700/50 rounded-full",
          "shadow-lg shadow-[0_0_12px_rgba(168,85,247,0.2)]",
          className,
        )}
      >
        <div className="relative">
          <Loader className="w-5 h-5 text-[color:var(--thanos-amethyst)] animate-spin" />
          <div className="absolute inset-0 blur-md bg-[color:var(--thanos-amethyst)]/30 animate-pulse" />
        </div>
        <span className="text-sm text-zinc-400 font-medium tracking-wide">Transcribing...</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 px-3 py-2",
        "bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-zinc-900/95",
        "backdrop-blur-xl",
        "border border-red-500/30 rounded-full",
        "shadow-lg shadow-red-500/10",
        className,
      )}
    >
      {/* Recording pulse */}
      <div className="relative flex items-center justify-center w-8 h-8 flex-shrink-0">
        <div
          className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
          style={{ animationDuration: "1.5s" }}
        />
        <div
          className="absolute inset-1 rounded-full bg-red-500/30 animate-ping"
          style={{ animationDuration: "1.5s", animationDelay: "0.5s" }}
        />
        <div
          className="relative w-3 h-3 rounded-full bg-red-500"
          style={{
            boxShadow: `0 0 ${12 + audioLevel * 12}px ${4 + audioLevel * 8}px rgba(239, 68, 68, ${0.4 + audioLevel * 0.4})`,
            transform: `scale(${1 + audioLevel * 0.3})`,
            transition: "all 50ms ease-out",
          }}
        />
      </div>

      {/* Waveform */}
      <div className="flex items-center gap-[2px] h-8 px-2 flex-1">
        {waveformData.map((level, i) => (
          <div
            key={i}
            className="w-[2px] rounded-full flex-shrink-0"
            style={{
              height: `${Math.max(4, level * 28)}px`,
              opacity: 0.4 + level * 0.6,
              background: `linear-gradient(to top, #dc2626, #f97316, #fbbf24)`,
              transition: "height 50ms ease-out, opacity 50ms ease-out",
            }}
          />
        ))}
      </div>

      {/* Duration */}
      <div className="flex items-center min-w-[48px] flex-shrink-0">
        <span className="text-sm font-mono text-zinc-300 tracking-wider">{formatDuration(duration)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
        <button
          onClick={cancelRecording}
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-700/50 border border-zinc-600/30 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-600/50 transition-all duration-200 active:scale-95"
          title="Cancel recording"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={sendRecording}
          type="button"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-400/30 text-white hover:from-emerald-400 hover:to-emerald-500 hover:scale-110 shadow-lg shadow-emerald-500/25 transition-all duration-200 active:scale-95"
          title="Accept & Transcribe"
        >
          <Send className="w-5 h-5" style={{ transform: "translateX(-1px)" }} />
        </button>
      </div>
    </div>
  )
}
