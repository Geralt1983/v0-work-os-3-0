"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ChevronRight, AlertTriangle, Zap, Send } from "lucide-react"
import { useChat, type Message, type TaskCard } from "@/hooks/use-chat"
import { VoiceRecorder } from "@/components/voice-recorder"
import { cn } from "@/lib/utils"

const ASSISTANT_NAME = "Synapse"

const QUICK_ACTIONS = [
  { label: "What's next?", prompt: "What should I work on next?" },
  { label: "Run triage", prompt: "Run triage on my tasks" },
  { label: "Status", prompt: "Give me a status update" },
]

interface SynapseSidebarProps {
  avoidanceWarning?: string | null
}

export function SynapseSidebar({ avoidanceWarning }: SynapseSidebarProps) {
  const { messages, isLoading, error, sendMessage, unreadCount, markAsSeen } = useChat() // Get unreadCount and markAsSeen
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("synapse-sidebar-collapsed") === "true"
  })
  const [input, setInput] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    scrollToBottom("smooth")
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    const message = input
    setInput("")
    await sendMessage(message)
  }

  const handleQuickAction = async (prompt: string) => {
    if (isLoading) return
    await sendMessage(prompt)
  }

  const handleTranscription = (text: string) => {
    setIsVoiceMode(false)
    // Send directly for natural voice experience
    sendMessage(text)
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
    <aside className="fixed top-0 right-0 bottom-0 w-[380px] bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800/50 flex flex-col z-40 animate-slide-in-right">
      {/* Header with gradient accent */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-gradient-to-r from-zinc-950 to-zinc-900">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight">{ASSISTANT_NAME}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">AI</span>
        </div>
        <button
          onClick={() => updateCollapsed(true)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all btn-press"
          title="Collapse sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
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
              <SidebarMessage key={message.id} message={message} />
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

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 min-w-0 rounded-full bg-zinc-900 border border-zinc-700 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            placeholder="Type or tap mic..."
          />

          {input.trim() ? (
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition flex items-center gap-2"
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
    </aside>
  )
}

function SidebarMessage({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "max-w-[90%] rounded-xl px-3 py-2 text-sm leading-snug",
          isUser ? "bg-indigo-600 text-white" : "border border-zinc-800 bg-zinc-900 text-zinc-100",
        )}
      >
        <p className="whitespace-pre-line">{message.content}</p>
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
