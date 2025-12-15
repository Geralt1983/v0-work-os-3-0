"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Zap, ChevronDown, Send } from "lucide-react"
import { useChat, type Message, type TaskCard } from "@/hooks/use-chat"
import { VoiceRecorder } from "@/components/voice-recorder"
import { cn } from "@/lib/utils"

const ASSISTANT_NAME = "Synapse"

const QUICK_ACTIONS = [
  { label: "What's next?", prompt: "What should I work on next?" },
  { label: "Triage", prompt: "Run triage on my tasks" },
  { label: "Status", prompt: "Give me a status update" },
]

export function SynapseMobileSheet() {
  const { messages, isLoading, error, sendMessage } = useChat()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen])

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
    // Send directly for natural voice experience
    sendMessage(text)
  }

  const handleVoiceError = (error: string) => {
    console.error("Voice error:", error)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-fuchsia-600 text-white shadow-lg hover:bg-fuchsia-500 transition-all hover:scale-105",
          isOpen && "hidden",
        )}
      >
        <Zap className="w-6 h-6" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs bg-white text-fuchsia-600 rounded-full font-medium">
            {messages.length > 9 ? "9+" : messages.length}
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
            <Zap className="w-5 h-5 text-fuchsia-400" />
            <span className="font-semibold text-zinc-100">{ASSISTANT_NAME}</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <ChevronDown className="w-5 h-5" />
          </button>
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
                <MobileMessage key={message.id} message={message} />
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
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 min-w-0 rounded-full bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 disabled:opacity-50"
              placeholder="Type or tap mic..."
            />

            {input.trim() ? (
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2.5 rounded-full bg-fuchsia-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-fuchsia-500 transition flex items-center gap-2"
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

function MobileMessage({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-snug",
          isUser ? "bg-fuchsia-600 text-white" : "border border-zinc-800 bg-zinc-900 text-zinc-100",
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
