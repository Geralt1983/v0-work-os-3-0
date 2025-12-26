/**
 * Shared API fetch utilities
 * Centralizes fetch logic to avoid duplication across hooks
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""

/**
 * Type-safe API fetch wrapper with error handling
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
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
export const swrFetcher = <T>(url: string): Promise<T> => apiFetch<T>(url)

/**
 * Shared SWR configuration presets
 */
export const SWR_CONFIG = {
  /** Default config for most data */
  default: {
    refreshInterval: 30000, // 30s instead of 10s
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  },
  /** Config for real-time data like chat */
  realtime: {
    refreshInterval: 15000, // 15s instead of 5s
    revalidateOnFocus: false,
  },
  /** Config for less frequently changing data */
  slow: {
    refreshInterval: 60000, // 60s
    revalidateOnFocus: true,
  },
  /** Config for rarely changing data */
  static: {
    refreshInterval: 120000, // 2 minutes
    revalidateOnFocus: false,
  },
} as const

/**
 * Parse and validate an ID parameter
 * Returns the parsed number or throws an error
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
 * Returns the parsed number or undefined if invalid
 */
export function parseOptionalId(id: string | number | undefined | null): number | undefined {
  if (id === undefined || id === null || id === "") return undefined
  try {
    return parseId(id)
  } catch {
    return undefined
  }
}
