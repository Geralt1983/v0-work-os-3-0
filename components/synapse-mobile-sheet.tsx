"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Zap, ChevronDown, Send, Paperclip, Trash2, X, Eye, EyeOff } from "lucide-react"
import { useChat, type Message, type TaskCard, type Attachment } from "@/hooks/use-chat"
import { VoiceRecorder } from "@/components/voice-recorder"
import { cn } from "@/lib/utils"

const ASSISTANT_NAME = "Synapse"

const QUICK_ACTIONS = [
  { label: "What's next?", prompt: "What should I work on next?" },
  { label: "Triage", prompt: "Run triage on my tasks" },
  { label: "Status", prompt: "Give me a status update" },
]

const ACTIVITY_OPEN = "[[ACTIVITY]]"
const ACTIVITY_CLOSE = "[[/ACTIVITY]]"

function extractActivity(content: string): { text: string; activity: string[] } {
  const start = content.indexOf(ACTIVITY_OPEN)
  const end = content.indexOf(ACTIVITY_CLOSE)
  if (start === -1 || end === -1 || end <= start) {
    return { text: content.trim(), activity: [] }
  }
  const before = content.slice(0, start).trim()
  const block = content.slice(start + ACTIVITY_OPEN.length, end).trim()
  const lines = block
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
  return { text: before, activity: lines }
}

export function SynapseMobileSheet() {
  const { messages, isLoading, error, sendMessage, clearChat, sessionId, unreadCount, markAsSeen } = useChat()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [selectedFile, setSelectedFile] = useState<{ name: string; base64: string; preview?: string } | null>(null)
  const [showActivity, setShowActivity] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = localStorage.getItem("synapse-activity-visible")
    return stored !== "false"
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    markAsSeen()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && !selectedFile) || isLoading) return
    const message = input
    setInput("")

    let attachments: Attachment[] = []
    let imageBase64: string | undefined

    if (selectedFile) {
      if (selectedFile.preview) {
        imageBase64 = selectedFile.base64
      }

      try {
        const blob = await fetch(selectedFile.base64).then((r) => r.blob())
        const formData = new FormData()
        formData.append("file", blob, selectedFile.name)

        const uploadRes = await fetch("/api/uploads", { method: "POST", body: formData })
        if (uploadRes.ok) {
          const uploaded = await uploadRes.json()
          attachments.push({
            id: uploaded.id,
            url: uploaded.url,
            name: uploaded.name,
            mime: uploaded.mime,
            size: uploaded.size,
          })
        }
      } catch (err) {
        console.error("Failed to upload file:", err)
      }
    }

    setSelectedFile(null)
    await sendMessage(message, imageBase64, attachments.length > 0 ? attachments : undefined)
  }

  const handleQuickAction = async (prompt: string) => {
    if (isLoading) return
    await sendMessage(prompt)
  }

  const handleTranscription = (text: string) => {
    // Send directly for natural voice experience
    sendMessage(text)
  }

  const handleVoiceError = (error: string) => {
    console.error("Voice error:", error)
  }

  const toggleActivity = () => {
    setShowActivity((prev) => {
      const next = !prev
      localStorage.setItem("synapse-activity-visible", String(next))
      return next
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Max 10MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setSelectedFile({
        name: file.name,
        base64,
        preview: file.type.startsWith("image/") ? base64 : undefined,
      })
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-500 transition-all hover:scale-105",
          isOpen && "hidden",
        )}
      >
        <Zap className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs bg-white text-indigo-600 rounded-full font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setIsOpen(false)} />}

      {/* Bottom sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 bg-zinc-950 rounded-t-2xl border-t border-zinc-800 transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{ height: "85vh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <button onClick={() => setIsOpen(false)} className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-zinc-100">{ASSISTANT_NAME}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
              OpenClaw Channel
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleActivity}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
              title={showActivity ? "Hide activity" : "Show activity"}
            >
              {showActivity ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            {messages.length > 0 && (
              <button
                onClick={async () => {
                  if (sessionId) {
                    await fetch("/api/chat/clear", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sessionId }),
                    })
                  }
                  clearChat()
                }}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-all"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick actions */}
        {messages.length < 2 && (
          <div className="flex gap-2 px-4 py-3 border-b border-zinc-800/50 overflow-x-auto">
            {QUICK_ACTIONS.map(({ label, prompt }) => (
              <button
                key={label}
                onClick={() => handleQuickAction(prompt)}
                disabled={isLoading}
                className="flex-shrink-0 px-3 py-1.5 text-xs rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ height: "calc(85vh - 160px)" }}>
          {messages.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              <p className="text-sm">Ask {ASSISTANT_NAME} anything</p>
              <p className="text-xs mt-1 text-zinc-600">Prioritize, analyze, or plan your work</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <MobileMessage key={message.id} message={message} showActivity={showActivity} />
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="border border-zinc-800 bg-zinc-900 rounded-xl px-3 py-2">
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Input area */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-zinc-800 bg-zinc-950">
          {selectedFile && (
            <div className="mb-2 p-2 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center gap-2">
              {selectedFile.preview ? (
                <img src={selectedFile.preview} alt="Preview" className="w-12 h-12 object-cover rounded" />
              ) : (
                <div className="w-12 h-12 bg-zinc-800 rounded flex items-center justify-center">
                  <Paperclip className="w-5 h-5 text-zinc-500" />
                </div>
              )}
              <span className="flex-1 text-xs text-zinc-400 truncate">{selectedFile.name}</span>
              <button onClick={() => setSelectedFile(null)} className="p-1 hover:bg-zinc-800 rounded">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-3 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50 flex-shrink-0"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 min-w-0 rounded-full bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="Type or tap mic..."
            />

            {input.trim() || selectedFile ? (
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedFile)}
                className="px-4 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-indigo-500 transition flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            ) : (
              <VoiceRecorder
                onTranscription={handleTranscription}
                onError={handleVoiceError}
                disabled={isLoading}
                compact
              />
            )}
          </form>
        </div>
      </div>
    </>
  )
}

function MobileMessage({ message, showActivity }: { message: Message; showActivity: boolean }) {
  const isUser = message.role === "user"
  const { text, activity } = extractActivity(message.content)

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-snug",
          isUser ? "bg-indigo-600 text-white" : "border border-zinc-800 bg-zinc-900 text-zinc-100",
        )}
      >
        <p className="whitespace-pre-line">{text}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((att) => (
              <div key={att.id} className="rounded-lg overflow-hidden">
                {att.mime.startsWith("audio/") ? (
                  <audio controls className="w-full h-8" src={att.url}>
                    <a href={att.url} download={att.name}>
                      {att.name}
                    </a>
                  </audio>
                ) : att.mime.startsWith("image/") ? (
                  <img src={att.url} alt={att.name} className="max-w-full rounded" />
                ) : (
                  <a
                    href={att.url}
                    download={att.name}
                    className="flex items-center gap-2 text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    <Paperclip className="w-3 h-3" />
                    {att.name}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        {showActivity && activity.length > 0 && (
          <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 text-xs text-zinc-300">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Activity</div>
            <div className="space-y-1">
              {activity.map((line, idx) => (
                <div key={`${line}-${idx}`} className="flex items-start gap-2">
                  <span className="text-zinc-500">•</span>
                  <span className="flex-1">{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {message.taskCard && <TaskCardDisplay card={message.taskCard} />}
      </div>
    </div>
  )
}

function TaskCardDisplay({ card }: { card: TaskCard }) {
  return (
    <div className="mt-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <div className="text-xs font-medium text-zinc-200">{card.title}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">{card.status}</span>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  )
}
