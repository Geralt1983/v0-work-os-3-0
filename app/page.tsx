"use client"

import { WorkOSNav } from "@/components/work-os-nav"
import { PageHeader } from "@/components/page-header"

const ASSISTANT_NAME = "Synapse"

const MOCK_MESSAGES = [
  {
    id: "1",
    role: "assistant" as const,
    content: "Morning Jeremy. You are at 2.7 hours of focused work and Orlando is the most under-touched client today.",
  },
  {
    id: "2",
    role: "user" as const,
    content: "What should I work on next?",
  },
  {
    id: "3",
    role: "assistant" as const,
    content: 'I would finish "Email picture for Teams" for Orlando, then pull the top Up Next move from Memphis.',
  },
]

type Message = (typeof MOCK_MESSAGES)[number]

function ChatTranscript({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => {
        const isUser = message.role === "user"
        return (
          <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
              className={[
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug",
                isUser ? "bg-white text-black shadow-sm" : "border border-zinc-800 bg-zinc-900 text-zinc-100",
              ].join(" ")}
            >
              {!isUser && (
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {ASSISTANT_NAME.toUpperCase()}
                </div>
              )}
              <p className="whitespace-pre-line">{message.content}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChatComposer() {
  return (
    <form className="flex items-center gap-2">
      <input
        className="flex-1 min-w-0 rounded-full bg-zinc-900 px-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none md:text-sm"
        placeholder="Tell me about your tasks or ask what to do next"
      />
      <button type="submit" className="px-4 py-2 rounded-full bg-white text-black text-xs font-medium md:text-sm">
        Send
      </button>
    </form>
  )
}

export default function ChatPage() {
  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      <div className="flex-none mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="Chat" description="Talk to your work brain." />
          <div className="flex-shrink-0 pt-4">
            <WorkOSNav />
          </div>
        </div>
      </div>

      <main className="flex-1 min-h-0 mx-auto w-full max-w-xl px-3 pb-3 flex flex-col md:px-4 md:pb-4">
        <div className="flex-none grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 mb-2 md:mb-3">
          {["What should I work on next", "Show me stale clients", "Run triage", "Summarize today"].map((label) => (
            <button
              key={label}
              className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-left text-xs text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100 md:px-4 md:py-2 md:text-sm"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="rounded-3xl border border-zinc-900/80 bg-zinc-950/70 px-3 py-3 sm:px-4 sm:py-4">
            <ChatTranscript messages={MOCK_MESSAGES} />
          </div>
        </div>

        <div className="flex-none pt-2 md:pt-3">
          <ChatComposer />
        </div>
      </main>
    </div>
  )
}
