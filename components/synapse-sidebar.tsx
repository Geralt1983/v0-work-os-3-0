"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ChevronRight, AlertTriangle, Zap, Send, Paperclip, X, Trash2, Eye, EyeOff } from "lucide-react"
import { useChat, type Message, type TaskCard, type Attachment } from "@/hooks/use-chat"
import { VoiceRecorder } from "@/components/voice-recorder"
import { cn } from "@/lib/utils"

const ASSISTANT_NAME = "Synapse"

const QUICK_ACTIONS = [
  { label: "What's next?", prompt: "What should I work on next?" },
  { label: "Run triage", prompt: "Run triage on my tasks" },
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

interface SynapseSidebarProps {
  avoidanceWarning?: string | null
}

export function SynapseSidebar({ avoidanceWarning }: SynapseSidebarProps) {
  const { messages, isLoading, error, sendMessage, clearChat, sessionId, unreadCount, markAsSeen } = useChat() // Get unreadCount and markAsSeen
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("synapse-sidebar-collapsed") === "true"
  })
  const [showActivity, setShowActivity] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = localStorage.getItem("synapse-activity-visible")
    return stored !== "false"
  })
  const [input, setInput] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ name: string; base64: string; preview?: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  const updateCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
    localStorage.setItem("synapse-sidebar-collapsed", String(collapsed))
    window.dispatchEvent(new Event("synapse-collapse-change"))

    if (!collapsed) {
      setTimeout(() => scrollToBottom("auto"), 50)
      markAsSeen() // Mark messages as seen when opening sidebar
    }
  }

  useEffect(() => {
    scrollToBottom("auto")
  }, []) // Initial mount

  const toggleActivity = () => {
    setShowActivity((prev) => {
      const next = !prev
      localStorage.setItem("synapse-activity-visible", String(next))
      return next
    })
  }

  useEffect(() => {
    scrollToBottom("smooth")
  }, [messages])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 10MB)
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

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const clearFile = () => setSelectedFile(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && !selectedFile) || isLoading) return
    const message = input
    setInput("")
    
    let attachments: Attachment[] = []
    let imageBase64: string | undefined
    
    if (selectedFile) {
      // For images, keep using base64 for vision models
      if (selectedFile.preview) {
        imageBase64 = selectedFile.base64
      }
      
      // Also upload to get a permanent URL
      try {
        const base64Data = selectedFile.base64.split(",")[1] || selectedFile.base64
        const mimeMatch = selectedFile.base64.match(/data:([^;]+);/)
        const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream"
        
        const blob = await fetch(selectedFile.base64).then(r => r.blob())
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
    await sendMessage(
      message,
      imageBase64,
      attachments.length > 0 ? attachments : undefined,
      showActivity ? "show" : "hide",
    )
  }

  const handleQuickAction = async (prompt: string) => {
    if (isLoading) return
    await sendMessage(prompt, undefined, undefined, showActivity ? "show" : "hide")
  }

  const handleTranscription = (text: string) => {
    setIsVoiceMode(false)
    // Send directly for natural voice experience
    sendMessage(text, undefined, undefined, showActivity ? "show" : "hide")
  }

  const handleVoiceError = (error: string) => {
    setIsVoiceMode(false)
    console.error("Voice error:", error)
  }

  // Collapsed state - floating button with glow
  if (isCollapsed) {
    return (
      <button
        onClick={() => updateCollapsed(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-200 btn-press glow-ai"
      >
        <Zap className="w-5 h-5 animate-pulse" />
        <span className="font-semibold tracking-tight">Synapse</span>
        {unreadCount > 0 && (
          <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-white/20 rounded-full animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-[380px] bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800/50 flex flex-col z-40 animate-slide-in-right">
      {/* Header with gradient accent - Mobile optimized */}
      <div className="flex-none flex items-center justify-between px-3 sm:px-4 py-3 border-b border-zinc-800/50 bg-gradient-to-r from-zinc-950 to-zinc-900">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight text-sm sm:text-base truncate">{ASSISTANT_NAME}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium hidden sm:inline">
            OpenClaw Channel
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleActivity}
            className="p-2 sm:p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all btn-press touch-manipulation"
            title={showActivity ? "Hide activity" : "Show activity"}
          >
            {showActivity ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          {messages.length > 0 && (
            <button
              onClick={async () => {
                if (sessionId) {
                  await fetch('/api/chat/clear', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId })
                  })
                }
                clearChat()
              }}
              className="p-2 sm:p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-all btn-press touch-manipulation"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4 sm:w-4 sm:h-4" />
            </button>
          )}
          <button
            onClick={() => updateCollapsed(true)}
            className="p-2 sm:p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all btn-press touch-manipulation"
            title="Collapse sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Avoidance warning */}
      {avoidanceWarning && (
        <div className="flex-none mx-3 mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">{avoidanceWarning}</p>
        </div>
      )}

      {/* Quick actions */}
      {messages.length < 2 && (
        <div className="flex-none flex flex-wrap gap-2 px-3 py-3 border-b border-zinc-800/50">
          {QUICK_ACTIONS.map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => handleQuickAction(prompt)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-500 py-8">
            <p className="text-sm">Ask {ASSISTANT_NAME} anything</p>
            <p className="text-xs mt-1 text-zinc-600">I can help prioritize, analyze, or plan your work</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <SidebarMessage key={message.id} message={message} showActivity={showActivity} />
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
        <div className="flex-none mx-3 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="flex-none px-3 py-3 border-t border-zinc-800">
        {isVoiceMode && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" />
            <VoiceRecorder
              onTranscription={handleTranscription}
              onError={handleVoiceError}
              disabled={isLoading}
              className="relative z-20"
            />
          </div>
        )}

        {/* File preview */}
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
            <button onClick={clearFile} className="p-1 hover:bg-zinc-800 rounded">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Mobile-optimized attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-3 sm:p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50 touch-manipulation flex-shrink-0"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 min-w-0 rounded-full bg-zinc-900 border border-zinc-700 px-4 py-2.5 sm:py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            placeholder="Type or tap mic..."
          />

          {input.trim() || selectedFile ? (
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !selectedFile)}
              className="px-4 py-2.5 sm:py-2 rounded-full bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition flex items-center gap-2 touch-manipulation flex-shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          ) : (
            <div className="flex-shrink-0">
              <VoiceRecorder
                onTranscription={handleTranscription}
                onError={handleVoiceError}
                disabled={isLoading}
                compact
              />
            </div>
          )}
        </form>
      </div>
    </aside>
  )
}

function SidebarMessage({ message, showActivity }: { message: Message; showActivity: boolean }) {
  const isUser = message.role === "user"
  const { text, activity } = extractActivity(message.content)

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "max-w-[90%] rounded-xl px-3 py-2 text-sm leading-snug",
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
                    <a href={att.url} download={att.name}>{att.name}</a>
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
        {card.dueDate && <span className="text-[10px] text-zinc-500">{card.dueDate}</span>}
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
