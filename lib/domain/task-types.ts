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

// -----------------------------------------------------------------------------
// Value Tier System (replaces time-based complexity)
// -----------------------------------------------------------------------------

/** Value tier - measures what a task produces, not how long it takes */
export type ValueTier = "checkbox" | "progress" | "deliverable" | "milestone"

/** Points for each value tier */
export const VALUE_POINTS: Record<ValueTier, number> = {
  checkbox: 1,    // Had to happen, low stakes (admin, scheduling, emails)
  progress: 2,    // Moved something forward (research, drafting, prep)
  deliverable: 4, // Client sees output (specs, docs, proposals sent)
  milestone: 7,   // Significant completion (go-live, major deliverable)
} as const

/** Value tier display configuration */
export const VALUE_TIER_CONFIG: Record<ValueTier, {
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  checkbox: {
    label: "Checkbox",
    description: "Admin, had to happen",
    color: "text-zinc-400",
    bgColor: "bg-zinc-800/50",
    borderColor: "border-zinc-600",
  },
  progress: {
    label: "Progress",
    description: "Moved something forward",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  deliverable: {
    label: "Deliverable",
    description: "Client sees output",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  milestone: {
    label: "Milestone",
    description: "Major checkpoint",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
  },
}

/** Default value tier for new tasks */
export const DEFAULT_VALUE_TIER: ValueTier = "progress"

/** Daily target in points */
export const DAILY_TARGET_POINTS = 16

/** Get points for a value tier */
export function getValueTierPoints(tier: ValueTier | string | null | undefined): number {
  if (!tier || !(tier in VALUE_POINTS)) return VALUE_POINTS.progress
  return VALUE_POINTS[tier as ValueTier]
}

/** Get value tier config */
export function getValueTierConfig(tier: ValueTier | string | null | undefined) {
  if (!tier || !(tier in VALUE_TIER_CONFIG)) return VALUE_TIER_CONFIG.progress
  return VALUE_TIER_CONFIG[tier as ValueTier]
}

/** Get task points from task object */
export function getTaskPoints(task: {
  valueTier?: string | null
  pointsFinal?: number | null
  pointsAiGuess?: number | null
  effortEstimate?: number | null
}): number {
  // Prefer value tier if present
  if (task.valueTier) {
    return getValueTierPoints(task.valueTier)
  }
  // Fall back to legacy points
  return task.pointsFinal ?? task.pointsAiGuess ?? task.effortEstimate ?? VALUE_POINTS.progress
}

/** Calculate total points from tasks */
export function calculateTotalPoints(
  tasks: Array<{
    valueTier?: string | null
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
// Legacy compatibility (deprecated)
// -----------------------------------------------------------------------------

/** @deprecated Use ValueTier instead */
export type TaskSizeType = "Quick" | "Routine" | "Meaningful" | "Heavy" | "Major"

/** @deprecated Use VALUE_POINTS.progress instead */
export const DEFAULT_POINTS = VALUE_POINTS.progress

/** @deprecated Use DEFAULT_POINTS instead */
export const DEFAULT_EFFORT = VALUE_POINTS.progress

/** @deprecated Map legacy effort to value tier */
export function effortToValueTier(effort: number | null | undefined): ValueTier {
  if (!effort) return "progress"
  if (effort <= 2) return "checkbox"
  if (effort <= 4) return "progress"
  if (effort <= 6) return "deliverable"
  return "milestone"
}

/** @deprecated Use getValueTierPoints instead */
export function effortToPoints(effort: number | null | undefined): number {
  return getValueTierPoints(effortToValueTier(effort))
}

/** @deprecated For legacy UI compatibility */
export function pointsToSize(points: number | null | undefined): TaskSizeType {
  if (!points) return "Routine"
  if (points <= 2) return "Quick"
  if (points <= 4) return "Routine"
  if (points <= 6) return "Meaningful"
  if (points <= 8) return "Heavy"
  return "Major"
}

/** @deprecated For legacy UI compatibility */
export function effortToSize(effort: number | null | undefined): TaskSizeType {
  return pointsToSize(effort)
}

/** @deprecated Use VALUE_TIER_CONFIG color instead */
export function getPointsColor(points: number): string {
  if (points <= 1) return "text-zinc-400"
  if (points <= 2) return "text-blue-400"
  if (points <= 4) return "text-emerald-400"
  return "text-violet-400"
}

/** @deprecated Use VALUE_TIER_CONFIG label instead */
export function getPointsLabel(points: number): string {
  if (points <= 1) return "Checkbox"
  if (points <= 2) return "Progress"
  if (points <= 4) return "Deliverable"
  return "Milestone"
}

/** @deprecated Convert size type to effort points */
export function sizeToEffort(size: TaskSizeType): number {
  switch (size) {
    case "Quick": return 2
    case "Routine": return 4
    case "Meaningful": return 6
    case "Heavy": return 8
    case "Major": return 10
    default: return VALUE_POINTS.progress
  }
}
