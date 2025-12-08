// Server API wrapper for clients
import { apiRequest } from "./api-client"

export interface Client {
  id: number
  name: string
  sentiment?: string
  importance?: string
  archived?: boolean
}

const BASE = "/api/clients"

export function listClients(): Promise<Client[]> {
  return apiRequest<Client[]>(BASE)
}

export function createClient(payload: Partial<Client>): Promise<Client> {
  return apiRequest<Client>(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getClient(id: number): Promise<Client> {
  return apiRequest<Client>(`${BASE}/${id}`)
}

export function updateClient(id: number, payload: Partial<Client>): Promise<Client> {
  return apiRequest<Client>(`${BASE}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function archiveClient(id: number): Promise<void> {
  return apiRequest<void>(`${BASE}/${id}`, {
    method: "DELETE",
  })
}

export function setClientSentiment(clientName: string, sentiment: string): Promise<void> {
  return apiRequest<void>(`/api/client-memory/${encodeURIComponent(clientName)}/sentiment`, {
    method: "PATCH",
    body: JSON.stringify({ sentiment }),
  })
}

export function setClientImportance(clientName: string, importance: string): Promise<void> {
  return apiRequest<void>(`/api/client-memory/${encodeURIComponent(clientName)}/importance`, {
    method: "PATCH",
    body: JSON.stringify({ importance }),
  })
}
