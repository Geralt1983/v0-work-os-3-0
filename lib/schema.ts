import { pgTable, serial, text, integer, timestamp, jsonb, varchar, decimal, date } from "drizzle-orm/pg-core"
import type { InferSelectModel } from "drizzle-orm"

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
// MOVES
// =============================================================================
export const moves = pgTable("moves", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"),
  effortEstimate: integer("effort_estimate").default(2),
  effortActual: integer("effort_actual"),
  drainType: text("drain_type"),
  sortOrder: integer("sort_order").default(0),
  subtasks: jsonb("subtasks").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
})

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
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  taskCard: jsonb("task_card"),
})

// =============================================================================
// CLIENT MEMORY
// =============================================================================
export const clientMemory = pgTable("client_memory", {
  id: text("id").primaryKey(),
  clientName: text("client_name").notNull().unique(),
  tier: text("tier").default("active"),
  lastMoveId: text("last_move_id"),
  lastMoveDescription: text("last_move_description"),
  lastMoveAt: timestamp("last_move_at"),
  totalMoves: integer("total_moves").default(0),
  staleDays: integer("stale_days").default(0),
  notes: text("notes"),
  sentiment: text("sentiment").default("neutral"),
  importance: text("importance").default("medium"),
  preferredWorkTime: text("preferred_work_time"),
  avoidanceScore: integer("avoidance_score").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// =============================================================================
// DAILY LOG
// =============================================================================
export const dailyLog = pgTable("daily_log", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  completedMoves: jsonb("completed_moves"),
  clientsTouched: jsonb("clients_touched"),
  clientsSkipped: jsonb("clients_skipped"),
  summary: text("summary"),
  backlogMovesCount: integer("backlog_moves_count").default(0),
  nonBacklogMovesCount: integer("non_backlog_moves_count").default(0),
  notificationsSent: jsonb("notifications_sent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// =============================================================================
// DAILY SNAPSHOTS
// =============================================================================
export const dailySnapshots = pgTable("daily_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  movesCompleted: integer("moves_completed").default(0),
  minutesEarned: integer("minutes_earned").default(0),
  clientsTouched: text("clients_touched").array().default([]),
  drainTypesUsed: text("drain_types_used").array().default([]),
  avgMomentum: decimal("avg_momentum", { precision: 5, scale: 2 }),
  staleClients: text("stale_clients").array().default([]),
  avoidanceIncidents: integer("avoidance_incidents").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// =============================================================================
// MOVE GRAVEYARD
// =============================================================================
export const moveGraveyard = pgTable("move_graveyard", {
  id: serial("id").primaryKey(),
  originalMoveId: integer("original_move_id"),
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
// MOVE EVENTS
// =============================================================================
export const moveEvents = pgTable("move_events", {
  id: serial("id").primaryKey(),
  moveId: integer("move_id")
    .notNull()
    .references(() => moves.id),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  fromStatus: varchar("from_status", { length: 50 }),
  toStatus: varchar("to_status", { length: 50 }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
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
export type Move = InferSelectModel<typeof moves>
export type Session = InferSelectModel<typeof sessions>
export type Message = InferSelectModel<typeof messages>
export type MoveEvent = InferSelectModel<typeof moveEvents>
export type BehavioralPattern = InferSelectModel<typeof behavioralPatterns>
export type DailySnapshot = InferSelectModel<typeof dailySnapshots>
export type GraveyardMove = InferSelectModel<typeof moveGraveyard>
export type MoveStatus = "active" | "queued" | "backlog" | "done"
export type DrainType = "deep" | "comms" | "admin" | "creative" | "easy"

export type Subtask = {
  id: string
  title: string
  completed: boolean
}
