// Server API wrapper for chat and sessions
import { apiRequest } from "./api-client"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp?: number
}

export interface ChatResponse {
  message: ChatMessage
  suggestions?: string[]
}

export interface Session {
  id: string
  createdAt: number
  title?: string
}

export function sendChatMessage(payload: { message: string; image?: string }): Promise<ChatResponse> {
  return apiRequest<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function createSession(payload: { title?: string }): Promise<Session> {
  return apiRequest<Session>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getSessionMessages(id: string): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/api/sessions/${id}/messages`)
}
