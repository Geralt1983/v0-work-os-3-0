// =============================================================================
// TASK DOMAIN TYPES AND CONSTANTS
// Centralized type definitions and mappings for the task system
// =============================================================================

// -----------------------------------------------------------------------------
// Status Types
// -----------------------------------------------------------------------------

/** Backend status values (stored in database) */
export type BackendTaskStatus = "active" | "queued" | "backlog" | "done"

/** Frontend status values (displayed in UI) */
export type FrontendTaskStatus = "today" | "upnext" | "backlog" | "done"

/** Drain type for energy management */
export type DrainType = "deep" | "shallow" | "admin"

/** Task complexity/size type */
export type TaskSizeType = "Quick" | "Standard" | "Chunky" | "Deep"

// -----------------------------------------------------------------------------
// Status Mappings
// -----------------------------------------------------------------------------

/** Map backend status to frontend display status */
export const STATUS_TO_FRONTEND: Record<BackendTaskStatus, FrontendTaskStatus> = {
  active: "today",
  queued: "upnext",
  backlog: "backlog",
  done: "done",
}

/** Map frontend status to backend storage status */
export const STATUS_TO_BACKEND: Record<FrontendTaskStatus, BackendTaskStatus> = {
  today: "active",
  upnext: "queued",
  backlog: "backlog",
  done: "done",
}

/** Convert backend status to frontend status */
export function toFrontendStatus(status: BackendTaskStatus): FrontendTaskStatus {
  return STATUS_TO_FRONTEND[status]
}

/** Convert frontend status to backend status */
export function toBackendStatus(status: FrontendTaskStatus): BackendTaskStatus {
  return STATUS_TO_BACKEND[status]
}

// -----------------------------------------------------------------------------
// Points System (Complexity-based, not time-based)
// -----------------------------------------------------------------------------

/** Default points when not specified */
export const DEFAULT_POINTS = 2

/** Daily target in points (complexity units) */
export const DAILY_TARGET_POINTS = 18

/** Points thresholds for size labels */
export const POINTS_TO_SIZE: Record<number, TaskSizeType> = {
  1: "Quick",     // 1-2 points
  2: "Quick",
  3: "Standard",  // 3-4 points
  4: "Standard",
  5: "Chunky",    // 5-7 points
  6: "Chunky",
  7: "Chunky",
  8: "Deep",      // 8-10 points
  9: "Deep",
  10: "Deep",
}

/** Get task size label from points */
export function pointsToSize(points: number | null | undefined): TaskSizeType {
  if (!points) return "Standard"
  const clamped = Math.max(1, Math.min(10, points))
  return POINTS_TO_SIZE[clamped] ?? "Standard"
}

/** Get points from task (prefers pointsFinal, falls back to pointsAiGuess, then effortEstimate for legacy) */
export function getTaskPoints(task: {
  pointsFinal?: number | null
  pointsAiGuess?: number | null
  effortEstimate?: number | null
}): number {
  return task.pointsFinal ?? task.pointsAiGuess ?? task.effortEstimate ?? DEFAULT_POINTS
}

/** Calculate total points from tasks */
export function calculateTotalPoints(
  tasks: Array<{
    pointsFinal?: number | null
    pointsAiGuess?: number | null
    effortEstimate?: number | null
  }>
): number {
  return tasks.reduce((sum, task) => sum + getTaskPoints(task), 0)
}

/** Get progress percentage towards daily goal */
export function getPointsProgress(earnedPoints: number, targetPoints: number = DAILY_TARGET_POINTS): number {
  return Math.min(100, Math.round((earnedPoints / targetPoints) * 100))
}

/** Get color class based on points (for UI) */
export function getPointsColor(points: number): string {
  if (points <= 2) return "text-emerald-400"
  if (points <= 4) return "text-green-400"
  if (points <= 6) return "text-yellow-400"
  if (points <= 8) return "text-orange-400"
  return "text-red-400"
}

/** Get complexity label for points */
export function getPointsLabel(points: number): string {
  if (points <= 2) return "Quick"
  if (points <= 4) return "Routine"
  if (points <= 6) return "Meaningful"
  if (points <= 8) return "Heavy"
  return "Major"
}

// -----------------------------------------------------------------------------
// Legacy compatibility (deprecated, prefer points-based functions)
// -----------------------------------------------------------------------------

/** @deprecated Use DEFAULT_POINTS instead */
export const DEFAULT_EFFORT = DEFAULT_POINTS

/** @deprecated Use pointsToSize instead */
export function effortToSize(effort: number | null | undefined): TaskSizeType {
  return pointsToSize(effort)
}

/** @deprecated Use getTaskPoints instead */
export function effortToPoints(effort: number | null | undefined): number {
  return effort ?? DEFAULT_POINTS
}

/** Convert size type to effort points (legacy compatibility) */
export function sizeToEffort(size: TaskSizeType): number {
  switch (size) {
    case "Quick":
      return 2
    case "Standard":
      return 3
    case "Chunky":
      return 5
    case "Deep":
      return 8
    default:
      return DEFAULT_POINTS
  }
}
