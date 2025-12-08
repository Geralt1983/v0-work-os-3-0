// Mock data for preview/development environment only
// This data will NOT appear in production

export const MOCK_CLIENTS = [
  { id: 1, name: "Acme Corp", type: "client", color: "#3B82F6", isActive: 1, createdAt: new Date().toISOString() },
  { id: 2, name: "TechStart", type: "client", color: "#10B981", isActive: 1, createdAt: new Date().toISOString() },
  { id: 3, name: "Global Media", type: "client", color: "#F59E0B", isActive: 1, createdAt: new Date().toISOString() },
  { id: 4, name: "Internal", type: "internal", color: "#6B7280", isActive: 1, createdAt: new Date().toISOString() },
  { id: 5, name: "Side Project", type: "personal", color: "#8B5CF6", isActive: 1, createdAt: new Date().toISOString() },
]

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

export const MOCK_MOVES = [
  // Acme Corp moves
  {
    id: 1,
    clientId: 1,
    clientName: "Acme Corp",
    title: "Review Q4 proposal",
    description: "Final review before client presentation",
    status: "active",
    effortEstimate: 3,
    drainType: "deep",
    sortOrder: 0,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(0),
    completedAt: null,
  },
  {
    id: 2,
    clientId: 1,
    clientName: "Acme Corp",
    title: "Send weekly update email",
    description: "Status update on project progress",
    status: "queued",
    effortEstimate: 1,
    drainType: "comms",
    sortOrder: 0,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(0),
    completedAt: null,
  },
  {
    id: 3,
    clientId: 1,
    clientName: "Acme Corp",
    title: "Prepare invoice",
    description: "November services invoice",
    status: "backlog",
    effortEstimate: 2,
    drainType: "admin",
    sortOrder: 0,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(3),
    completedAt: null,
  },

  // TechStart moves
  {
    id: 4,
    clientId: 2,
    clientName: "TechStart",
    title: "Debug authentication flow",
    description: "Fix login redirect issue",
    status: "active",
    effortEstimate: 4,
    drainType: "deep",
    sortOrder: 1,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(0),
    completedAt: null,
  },
  {
    id: 5,
    clientId: 2,
    clientName: "TechStart",
    title: "Design landing page mockup",
    description: "Create 3 variations for review",
    status: "queued",
    effortEstimate: 3,
    drainType: "creative",
    sortOrder: 1,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
    completedAt: null,
  },
  {
    id: 6,
    clientId: 2,
    clientName: "TechStart",
    title: "Write API documentation",
    description: "Document all endpoints",
    status: "backlog",
    effortEstimate: 2,
    drainType: "deep",
    sortOrder: 1,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(5),
    completedAt: null,
  },

  // Global Media moves
  {
    id: 7,
    clientId: 3,
    clientName: "Global Media",
    title: "Schedule strategy call",
    description: "Discuss 2024 content calendar",
    status: "queued",
    effortEstimate: 1,
    drainType: "comms",
    sortOrder: 2,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(0),
    completedAt: null,
  },
  {
    id: 8,
    clientId: 3,
    clientName: "Global Media",
    title: "Review analytics report",
    description: "Monthly performance review",
    status: "backlog",
    effortEstimate: 2,
    drainType: "admin",
    sortOrder: 2,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(4),
    completedAt: null,
  },

  // Internal moves
  {
    id: 9,
    clientId: 4,
    clientName: "Internal",
    title: "Update timesheet",
    description: "Log hours for the week",
    status: "backlog",
    effortEstimate: 1,
    drainType: "easy",
    sortOrder: 0,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(0),
    completedAt: null,
  },

  // Side Project moves
  {
    id: 10,
    clientId: 5,
    clientName: "Side Project",
    title: "Brainstorm app features",
    description: "List ideas for v2 release",
    status: "backlog",
    effortEstimate: 2,
    drainType: "creative",
    sortOrder: 0,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(8),
    completedAt: null,
  },

  // Some completed moves for metrics
  {
    id: 11,
    clientId: 1,
    clientName: "Acme Corp",
    title: "Client kickoff meeting",
    description: "Initial project scope discussion",
    status: "done",
    effortEstimate: 2,
    drainType: "comms",
    sortOrder: 0,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(12),
    completedAt: daysAgo(12),
  },
  {
    id: 12,
    clientId: 2,
    clientName: "TechStart",
    title: "Setup dev environment",
    description: "Configure local development",
    status: "done",
    effortEstimate: 1,
    drainType: "easy",
    sortOrder: 0,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(9),
    completedAt: daysAgo(9),
  },
]

export function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") {
    // Server-side: check for Vercel preview or development
    return process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development"
  }
  const hostname = window.location.hostname
  const isPreview = hostname.includes("vusercontent.net") || hostname === "localhost" || hostname.includes("v0.dev")

  console.log("[v0] isPreviewEnvironment:", { hostname, isPreview })
  return isPreview
}
