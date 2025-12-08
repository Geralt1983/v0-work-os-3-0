"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"

// =============================================================================
// API CONFIGURATION - Using local API routes
// =============================================================================
const API_BASE_URL = ""

// =============================================================================
// TYPES
// =============================================================================
export interface Message {
  id: string
  sessionId: string
  role: "user" | "assistant"
  content: string
  timestamp?: string
  taskCard?: TaskCard | null
}

export interface TaskCard {
  title: string
  taskId: string
  status: string
  dueDate?: string
}

export interface ChatSession {
  id: string
  createdAt: string
  lastActiveAt: string
  messageCount: number
  preview: string | null
}

interface ChatResponse {
  sessionId: string
  userMessage: { id: string; role: "user"; content: string }
  assistantMessage: { id: string; role: "assistant"; content: string; taskCard?: TaskCard }
}

// =============================================================================
// API HELPERS
// =============================================================================
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.text().catch(() => "Unknown error")
    throw new Error(`API error ${res.status}: ${error}`)
  }

  return res.json()
}

// =============================================================================
// CHAT SESSIONS HOOK
// =============================================================================
export function useChatSessions() {
  const { data, error, isLoading, mutate } = useSWR<ChatSession[]>(
    "chat-sessions",
    () => apiFetch<ChatSession[]>("/api/sessions"),
    { revalidateOnFocus: false },
  )

  return {
    sessions: data || [],
    isLoading,
    error: error?.message,
    refresh: mutate,
  }
}

// =============================================================================
// CHAT HOOK
// =============================================================================
export function useChat() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("workos-chat-session")
    if (stored) {
      setSessionId(stored)
    }
  }, [])

  // Fetch message history when sessionId is set
  const { data: historyData, mutate: mutateHistory } = useSWR<Message[]>(
    sessionId ? `session-${sessionId}-messages` : null,
    async () => {
      if (!sessionId) return []
      try {
        const messages = await apiFetch<Message[]>(`/api/sessions/${sessionId}/messages`)
        return messages
      } catch {
        return []
      }
    },
    { revalidateOnFocus: false },
  )

  // Update messages when history loads
  useEffect(() => {
    if (historyData && historyData.length > 0) {
      setMessages(historyData)
    }
  }, [historyData])

  // Switch to a different session
  const switchSession = useCallback((newSessionId: string) => {
    setSessionId(newSessionId)
    setMessages([])
    localStorage.setItem("workos-chat-session", newSessionId)
  }, [])

  // Send a message
  const sendMessage = useCallback(
    async (content: string, imageBase64?: string) => {
      if (!content.trim() && !imageBase64) return

      setIsLoading(true)
      setError(null)

      // Optimistically add user message
      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        sessionId: sessionId || "pending",
        role: "user",
        content,
      }
      setMessages((prev) => [...prev, tempUserMsg])

      try {
        const response = await apiFetch<ChatResponse>("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            sessionId: sessionId || undefined,
            message: content,
            ...(imageBase64 && { imageBase64 }),
          }),
        })

        // Store session ID
        if (response.sessionId && response.sessionId !== sessionId) {
          setSessionId(response.sessionId)
          localStorage.setItem("workos-chat-session", response.sessionId)
        }

        // Replace temp message with real ones
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id)
          return [
            ...withoutTemp,
            {
              id: response.userMessage.id,
              sessionId: response.sessionId,
              role: "user" as const,
              content: response.userMessage.content,
            },
            {
              id: response.assistantMessage.id,
              sessionId: response.sessionId,
              role: "assistant" as const,
              content: response.assistantMessage.content,
              taskCard: response.assistantMessage.taskCard,
            },
          ]
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message")
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId],
  )

  // Clear chat / start new session
  const clearChat = useCallback(() => {
    setSessionId(null)
    setMessages([])
    localStorage.removeItem("workos-chat-session")
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    switchSession,
    sessionId,
  }
}
