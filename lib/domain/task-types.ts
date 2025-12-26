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
// Effort/Size Mappings
// -----------------------------------------------------------------------------

/** Minutes per effort unit */
export const MINUTES_PER_EFFORT = 20

/** Default effort estimate when not specified */
export const DEFAULT_EFFORT = 2

/** Daily target in minutes */
export const DAILY_TARGET_MINUTES = 180

/** Map effort level (1-4) to task size type */
export const EFFORT_TO_SIZE: Record<number, TaskSizeType> = {
  1: "Quick",
  2: "Standard",
  3: "Chunky",
  4: "Deep",
}

/** Map task size type to effort level */
export const SIZE_TO_EFFORT: Record<TaskSizeType, number> = {
  Quick: 1,
  Standard: 2,
  Chunky: 3,
  Deep: 4,
}

/** Convert effort level to task size type */
export function effortToSize(effort: number | null | undefined): TaskSizeType {
  if (!effort) return "Standard"
  return EFFORT_TO_SIZE[effort] ?? "Standard"
}

/** Convert task size type to effort level */
export function sizeToEffort(size: TaskSizeType): number {
  return SIZE_TO_EFFORT[size]
}

/** Convert effort to minutes */
export function effortToMinutes(effort: number | null | undefined): number {
  return (effort ?? DEFAULT_EFFORT) * MINUTES_PER_EFFORT
}

/** Calculate total minutes from effort estimates */
export function calculateTotalMinutes(
  tasks: Array<{ effortEstimate?: number | null; effortActual?: number | null }>,
  useActual = false
): number {
  return tasks.reduce((sum, task) => {
    const effort = useActual
      ? (task.effortActual ?? task.effortEstimate ?? DEFAULT_EFFORT)
      : (task.effortEstimate ?? DEFAULT_EFFORT)
    return sum + effort * MINUTES_PER_EFFORT
  }, 0)
}

// -----------------------------------------------------------------------------
// Points System
// -----------------------------------------------------------------------------

/** Default daily points target */
export const DAILY_TARGET_POINTS = 18

/** Calculate points from effort (1 effort = 1 point for now) */
export function effortToPoints(effort: number | null | undefined): number {
  return effort ?? DEFAULT_EFFORT
}
