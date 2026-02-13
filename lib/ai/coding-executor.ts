export type CodingExecutor = "codex" | "opencode"

interface ResolveCodingExecutorOptions {
  executor?: unknown
  openclawEnabled: boolean
}

/**
 * Resolve the coding workflow executor.
 * - Explicit config wins.
 * - If omitted, preserve legacy OpenClaw env-driven behavior.
 */
export function resolveCodingExecutor({ executor, openclawEnabled }: ResolveCodingExecutorOptions): CodingExecutor {
  if (executor === "codex" || executor === "opencode") {
    return executor
  }

  return openclawEnabled ? "opencode" : "codex"
}
