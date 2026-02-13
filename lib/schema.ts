import { pgTable, serial, text, integer, timestamp, jsonb, varchar, decimal, date, boolean, index } from "drizzle-orm/pg-core"
import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"

// =============================================================================
// CLIENTS
// =============================================================================
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull().default("client"),
  color: text("color"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// =============================================================================
// TASKS
// =============================================================================
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"),
  // Value tier system (checkbox/progress/deliverable/milestone)
  valueTier: varchar("value_tier", { length: 20 }).default("progress"),
  // Legacy fields (deprecated, kept for migration compatibility)
  effortEstimate: integer("effort_estimate").default(2),
  effortActual: integer("effort_actual"),
  drainType: text("drain_type"),
  sortOrder: integer("sort_order").default(0),
  subtasks: jsonb("subtasks").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  backlogEnteredAt: timestamp("backlog_entered_at", { withTimezone: true }),
  // Legacy points tracking (deprecated, use valueTier instead)
  pointsAiGuess: integer("points_ai_guess"),
  pointsFinal: integer("points_final"),
  pointsAdjustedAt: timestamp("points_adjusted_at", { withTimezone: true }),
}, (table) => [
  index("tasks_status_idx").on(table.status),
  index("tasks_client_id_idx").on(table.clientId),
  index("tasks_completed_at_idx").on(table.completedAt),
  index("tasks_sort_order_idx").on(table.sortOrder),
  index("tasks_status_sort_idx").on(table.status, table.sortOrder),
])

// =============================================================================
// SESSIONS (for chat)
// =============================================================================
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
})

// =============================================================================
// MESSAGES (for chat)
// =============================================================================
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .references(() => sessions.id)
    .notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  notebookId: text("notebook_id").default("general"),
  source: text("source").notNull().default("chat"),
  sourceMetadata: jsonb("source_metadata").default({}),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  taskCard: jsonb("task_card"),
})

export const messageAttachments = pgTable("message_attachments", {
  id: text("id").primaryKey(),
  messageId: text("message_id").references(() => messages.id).notNull(),
  type: text("type").notNull(), // "audio" | "image" | "document"
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  transcription: text("transcription"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// =============================================================================
// CLIENT MEMORY
// =============================================================================
export const clientMemory = pgTable("client_memory", {
  id: text("id").primaryKey(),
  clientName: text("client_name").notNull().unique(),
  tier: text("tier").default("active"),
  lastTaskId: text("last_task_id"),
  lastTaskDescription: text("last_task_description"),
  lastTaskAt: timestamp("last_task_at"),
  totalTasks: integer("total_tasks").default(0),
  staleDays: integer("stale_days").default(0),
  notes: text("notes"),
  sentiment: text("sentiment").default("neutral"),
  importance: text("importance").default("medium"),
  preferredWorkTime: text("preferred_work_time"),
  avoidanceScore: integer("avoidance_score").default(0),
  // Blocker tracking (for stale wall system)
  consecutiveSkips: integer("consecutive_skips").default(0),
  lastSkipDate: date("last_skip_date"),
  blockerReason: text("blocker_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// =============================================================================
// DAILY LOG
// =============================================================================
export const dailyLog = pgTable("daily_log", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  completedTasks: jsonb("completed_tasks"),
  clientsTouched: jsonb("clients_touched"),
  clientsSkipped: jsonb("clients_skipped"),
  summary: text("summary"),
  backlogTasksCount: integer("backlog_tasks_count").default(0),
  nonBacklogTasksCount: integer("non_backlog_tasks_count").default(0),
  notificationsSent: jsonb("notifications_sent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  workStartedNotified: boolean("work_started_notified").default(false),
  workStartedAt: timestamp("work_started_at", { withTimezone: true }),
  // Value-based points tracking
  pointsEarned: integer("points_earned").default(0),
  pointsTarget: integer("points_target").default(16),
  dayComplete: boolean("day_complete").default(false),
  staleBlockedClients: text("stale_blocked_clients"), // JSON array of client names that blocked
})

// =============================================================================
// DAILY SNAPSHOTS
// =============================================================================
export const dailySnapshots = pgTable("daily_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  tasksCompleted: integer("tasks_completed").default(0),
  minutesEarned: integer("minutes_earned").default(0),
  clientsTouched: text("clients_touched").array().default([]),
  drainTypesUsed: text("drain_types_used").array().default([]),
  avgMomentum: decimal("avg_momentum", { precision: 5, scale: 2 }),
  staleClients: text("stale_clients").array().default([]),
  avoidanceIncidents: integer("avoidance_incidents").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// =============================================================================
// TASK GRAVEYARD
// =============================================================================
export const taskGraveyard = pgTable("task_graveyard", {
  id: serial("id").primaryKey(),
  originalTaskId: integer("original_task_id"),
  clientId: integer("client_id").references(() => clients.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  effortEstimate: integer("effort_estimate"),
  drainType: varchar("drain_type", { length: 50 }),
  archivedAt: timestamp("archived_at", { withTimezone: true }).defaultNow(),
  archiveReason: varchar("archive_reason", { length: 50 }).default("auto_decay"),
  originalCreatedAt: timestamp("original_created_at", { withTimezone: true }),
  daysInBacklog: integer("days_in_backlog"),
})

// =============================================================================
// TASK EVENTS
// =============================================================================
export const taskEvents = pgTable("task_events", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  fromStatus: varchar("from_status", { length: 50 }),
  toStatus: varchar("to_status", { length: 50 }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// =============================================================================
// DAILY GOALS (points tracking with streaks and debt)
// =============================================================================
export const dailyGoals = pgTable("daily_goals", {
  id: serial("id").primaryKey(),
  date: date("date").unique().notNull(),
  targetPoints: integer("target_points").default(18),
  earnedPoints: integer("earned_points").default(0),
  taskCount: integer("task_count").default(0),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastGoalHitDate: date("last_goal_hit_date"),
  dailyDebt: integer("daily_debt").default(0), // Points below target for this day
  weeklyDebt: integer("weekly_debt").default(0), // Cumulative debt for the week
  pressureLevel: integer("pressure_level").default(0), // 0-5 scale for urgency
  lastUrgencyNotificationHour: integer("last_urgency_notification_hour"), // Track last hourly alert
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// =============================================================================
// HOLIDAYS
// =============================================================================
export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: date("date").unique().notNull(),
  description: text("description"), // Optional label like "Christmas", "Vacation"
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// =============================================================================
// BEHAVIORAL PATTERNS
// =============================================================================
export const behavioralPatterns = pgTable("behavioral_patterns", {
  id: serial("id").primaryKey(),
  patternType: varchar("pattern_type", { length: 50 }).notNull(),
  patternKey: varchar("pattern_key", { length: 100 }).notNull(),
  patternValue: jsonb("pattern_value").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.5"),
  sampleSize: integer("sample_size").default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================
export type Client = InferSelectModel<typeof clients>
export type Task = InferSelectModel<typeof tasks>
export type Session = InferSelectModel<typeof sessions>
export type Message = InferSelectModel<typeof messages>
export type MessageAttachment = InferSelectModel<typeof messageAttachments>
export type TaskEvent = InferSelectModel<typeof taskEvents>
export type BehavioralPattern = InferSelectModel<typeof behavioralPatterns>
export type DailySnapshot = InferSelectModel<typeof dailySnapshots>
export type DailyGoal = InferSelectModel<typeof dailyGoals>
export type GraveyardTask = InferSelectModel<typeof taskGraveyard>
export type Holiday = InferSelectModel<typeof holidays>
export type TaskStatus = "active" | "queued" | "backlog" | "done"
export type DrainType = "deep" | "shallow" | "admin"

export type Subtask = {
  id: string
  title: string
  completed: boolean
}

// =============================================================================
// RELATIONS
// =============================================================================
export const tasksRelations = relations(tasks, ({ one }) => ({
  client: one(clients, {
    fields: [tasks.clientId],
    references: [clients.id],
  }),
}))

export const clientsRelations = relations(clients, ({ many }) => ({
  tasks: many(tasks),
}))
