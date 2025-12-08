// Generic API client for the Work OS backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ""
const USE_SERVER_ENV = process.env.NEXT_PUBLIC_USE_SERVER === "true"

export const USE_SERVER = USE_SERVER_ENV && !!API_BASE_URL

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set")
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}
