"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { apiFetch, SWR_CONFIG } from "@/lib/fetch-utils"

// =============================================================================
// TYPES
// =============================================================================
export interface Attachment {
  id: string
  url: string
  name: string
  mime: string
  size: number
  durationMs?: number
  transcription?: string
}

export interface Message {
  id: string
  sessionId: string
  role: "user" | "assistant"
  content: string
  notebookId?: string | null
  source?: string
  sourceMetadata?: Record<string, unknown> | null
  timestamp?: string
  taskCard?: TaskCard | null
  attachments?: Attachment[]
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
  routingMetadata?: {
    mode: "auto" | "specific"
    requestedNotebookId: string | null
    candidateNotebookIds: string[]
    selectedNotebookIds: string[]
    notebookScores: Array<{ notebookId: string; score: number; retrievedTurns: number }>
  } | null
}

export interface ChatRagOptions {
  notebookId?: string
  ragRouteMode?: "auto" | "specific"
  candidateNotebookIds?: string[]
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
  const [lastSeenTime, setLastSeenTime] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const stored = localStorage.getItem("workos-chat-session")
    const lastSeen = localStorage.getItem("chat-last-seen")
    if (stored) {
      setSessionId(stored)
    }
    if (lastSeen) {
      setLastSeenTime(lastSeen)
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
    SWR_CONFIG.realtime, // Poll every 15s for cross-device sync
  )

  // Update messages when history loads
  useEffect(() => {
    if (historyData && historyData.length > 0) {
      setMessages(historyData)
    }
  }, [historyData])

  const unreadCount = messages.filter((m) => {
    if (m.role === "user") return false // Don't count user's own messages
    if (!lastSeenTime) return true // All messages are unread if never seen
    if (!m.timestamp) return false
    return new Date(m.timestamp) > new Date(lastSeenTime)
  }).length

  const markAsSeen = useCallback(() => {
    const now = new Date().toISOString()
    setLastSeenTime(now)
    localStorage.setItem("chat-last-seen", now)
    window.dispatchEvent(new Event("chat-seen"))
  }, [])

  // Switch to a different session
  const switchSession = useCallback((newSessionId: string) => {
    setSessionId(newSessionId)
    setMessages([])
    setError(null)
    localStorage.setItem("workos-chat-session", newSessionId)
  }, [])

  // Send a message
  const sendMessage = useCallback(
    async (
      content: string,
      imageBase64?: string,
      attachments?: Attachment[],
      activityMode?: "show" | "hide",
      ragOptions?: ChatRagOptions,
    ) => {
      if (!content.trim() && !imageBase64 && (!attachments || attachments.length === 0)) return

      const requestId = ++requestIdRef.current
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
            activityMode: activityMode || "show",
            ...(ragOptions?.notebookId && { notebookId: ragOptions.notebookId }),
            ...(ragOptions?.ragRouteMode && { ragRouteMode: ragOptions.ragRouteMode }),
            ...(ragOptions?.candidateNotebookIds && ragOptions.candidateNotebookIds.length > 0
              ? { candidateNotebookIds: ragOptions.candidateNotebookIds }
              : {}),
            ...(imageBase64 && { imageBase64 }),
            ...(attachments && attachments.length > 0 && { attachments }),
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

        markAsSeen()
        window.dispatchEvent(new Event("chat-message-received"))

        // Revalidate task lists after chat (Thanos may have created/updated/completed tasks)
        globalMutate("/api/tasks")
        globalMutate("/api/backlog/grouped")
        globalMutate("/api/backlog/recommendations")
        globalMutate("/api/metrics/today")
        globalMutate("/api/metrics/clients")

        mutateHistory()
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : "Failed to send message")
        }
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [sessionId, markAsSeen, mutateHistory],
  )

  // Clear chat / start new session
  const clearChat = useCallback(() => {
    setSessionId(null)
    setMessages([])
    setError(null)
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
    unreadCount, // Export unread count
    markAsSeen, // Export mark as seen function
  }
}
