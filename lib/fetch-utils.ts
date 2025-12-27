/**
 * Shared API fetch utilities
 * Centralizes fetch logic to avoid duplication across hooks
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""

/**
 * Type-safe API fetch wrapper with error handling
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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

/**
 * SWR fetcher function for GET requests
 */
export const swrFetcher = (url: string): Promise<unknown> => apiFetch(url)

/**
 * Shared SWR configuration presets
 */
export const SWR_CONFIG = {
  default: {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    keepPreviousData: true,
    dedupingInterval: 5000,
  },
  realtime: {
    refreshInterval: 15000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 2000,
  },
  slow: {
    refreshInterval: 60000,
    revalidateOnFocus: true,
    keepPreviousData: true,
    dedupingInterval: 10000,
  },
  static: {
    refreshInterval: 120000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 30000,
  },
} as const

/**
 * Parse and validate an ID parameter
 */
export function parseId(id: string | number): number {
  const parsed = typeof id === "number" ? id : Number.parseInt(id, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid ID: ${id}`)
  }
  return parsed
}

/**
 * Safely parse an optional ID parameter
 */
export function parseOptionalId(id: string | number | undefined | null): number | undefined {
  if (id === undefined || id === null || id === "") return undefined
  try {
    return parseId(id)
  } catch {
    return undefined
  }
}
