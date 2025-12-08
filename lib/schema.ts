import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core"

// =============================================================================
// CLIENTS
// =============================================================================
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("standard"),
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
  status: text("status").notNull().default("backlog"), // active, queued, backlog, done
  effortEstimate: integer("effort_estimate"), // 1=Quick, 2=Standard, 3=Chunky, 4=Deep
  effortActual: integer("effort_actual"),
  drainType: text("drain_type"),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
})

// =============================================================================
// SESSIONS (for chat)
// =============================================================================
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // UUID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
})

// =============================================================================
// MESSAGES (for chat)
// =============================================================================
export const messages = pgTable("messages", {
  id: text("id").primaryKey(), // UUID
  sessionId: text("session_id")
    .references(() => sessions.id)
    .notNull(),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  taskCard: jsonb("task_card"), // Optional task card data
})
