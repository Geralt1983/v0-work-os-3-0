"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { WorkOSNav } from "@/components/work-os-nav"
import { useChat, useChatSessions, type Message, type TaskCard, type ChatSession } from "@/hooks/use-chat"
import { MessageSquare, Plus } from "lucide-react"

const ASSISTANT_NAME = "Synapse"

// Quick action prompts
const QUICK_ACTIONS = ["What should I work on next", "Show me stale clients", "Run triage", "Summarize today"]

export default function ChatPage() {
  const { messages, isLoading, error, sendMessage, clearChat, switchSession, sessionId } = useChat()
  const { sessions } = useChatSessions()
  const [input, setInput] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const message = input
    setInput("")
    await sendMessage(message)
  }

  const handleQuickAction = async (action: string) => {
    if (isLoading) return
    await sendMessage(action)
  }

  const handleSelectSession = (session: ChatSession) => {
    switchSession(session.id)
    setShowHistory(false)
  }

  const handleNewChat = () => {
    clearChat()
    setShowHistory(false)
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="flex-none mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 md:text-3xl">Chat</h1>
              <p className="hidden sm:block text-sm text-white/60 mt-1">Talk to your work brain.</p>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="ml-2 p-2 rounded-lg hover:bg-zinc-800 transition text-zinc-400 hover:text-zinc-200"
              title="Chat history"
              aria-label="Toggle chat history"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-shrink-0 pt-1">
            <WorkOSNav />
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <main className="flex-1 min-h-0 mx-auto w-full max-w-xl px-3 pb-3 flex flex-col md:px-4 md:pb-4">
        {showHistory && (
          <div className="flex-none mb-3 rounded-xl border border-zinc-800 bg-zinc-900/90 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <span className="text-xs font-medium text-zinc-400">Recent Conversations</span>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300"
              >
                <Plus className="w-3 h-3" />
                New Chat
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-zinc-500">No recent conversations</div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`w-full px-3 py-2 text-left hover:bg-zinc-800/50 transition ${
                      session.id === sessionId ? "bg-zinc-800/80" : ""
                    }`}
                  >
                    <div className="text-xs text-zinc-200 truncate">{session.preview || "New conversation"}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-500">{formatRelativeTime(session.lastActiveAt)}</span>
                      <span className="text-[10px] text-zinc-600">{session.messageCount} messages</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Quick actions - show when no messages or few messages */}
        {messages.length < 2 && (
          <div className="flex-none grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 mb-2 md:mb-3">
            {QUICK_ACTIONS.map((label) => (
              <button
                key={label}
                onClick={() => handleQuickAction(label)}
                disabled={isLoading}
                className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-left text-xs text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50 md:px-4 md:py-2 md:text-sm"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="rounded-3xl border border-zinc-900/80 bg-zinc-950/70 px-3 py-3 sm:px-4 sm:py-4">
            {messages.length === 0 ? (
              <div className="text-center text-zinc-500 py-8">
                <p className="text-sm">Start a conversation with {ASSISTANT_NAME}</p>
                <p className="text-xs mt-1 text-zinc-600">Ask about your tasks, clients, or what to work on next</p>
              </div>
            ) : (
              <ChatTranscript messages={messages} isLoading={isLoading} />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="flex-none mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Input area */}
        <div className="flex-none pt-2 md:pt-3">
          <ChatComposer value={input} onChange={setInput} onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      </main>
    </div>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// =============================================================================
// COMPONENTS
// =============================================================================

function ChatTranscript({ messages, isLoading }: { messages: Message[]; isLoading: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="border border-zinc-800 bg-zinc-900 rounded-2xl px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {ASSISTANT_NAME.toUpperCase()}
            </div>
            <TypingIndicator />
          </div>
        </div>
      )}
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug",
          isUser ? "bg-white text-black shadow-sm" : "border border-zinc-800 bg-zinc-900 text-zinc-100",
        ].join(" ")}
      >
        {!isUser && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {ASSISTANT_NAME.toUpperCase()}
          </div>
        )}
        <p className="whitespace-pre-line">{message.content}</p>

        {/* Task card if present */}
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
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  )
}

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  isLoading: boolean
}

function ChatComposer({ value, onChange, onSubmit, isLoading }: ChatComposerProps) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className="flex-1 min-w-0 rounded-full bg-zinc-900 px-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 disabled:opacity-50 md:text-sm"
        placeholder="Tell me about your tasks or ask what to do next"
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="px-4 py-2 rounded-full bg-white text-black text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed md:text-sm hover:bg-zinc-200 transition"
      >
        Send
      </button>
    </form>
  )
}
