export const chatTools = [
  {
    type: "function" as const,
    function: {
      name: "get_all_client_pipelines",
      description: "Get pipeline status for ALL clients. Returns active/queued/backlog moves for every client.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_moves",
      description:
        "Search for moves by title or client name. Use this FIRST to find the move ID before completing, updating, or deleting.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term to match against move titles" },
          client_name: { type: "string", description: "Optional: filter by client name" },
          status: {
            type: "string",
            enum: ["active", "queued", "backlog", "done"],
            description: "Optional: filter by status",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_move",
      description: "Create a new move for a client. ALWAYS infer drain_type based on task content.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Move title - should be actionable and specific" },
          client_name: { type: "string", description: "Client name (case-insensitive, partial match supported)" },
          description: { type: "string", description: "Optional description" },
          status: {
            type: "string",
            enum: ["active", "queued", "backlog"],
            description: "Initial status (default: backlog)",
          },
          effort_estimate: {
            type: "number",
            enum: [1, 2, 3, 4],
            description: "1=quick, 2=standard, 3=chunky, 4=draining",
          },
          drain_type: { type: "string", enum: ["deep", "comms", "admin", "creative", "easy"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_move",
      description: "Update an existing move's title, description, status, effort, or drain type.",
      parameters: {
        type: "object",
        properties: {
          move_id: { type: "number", description: "The move ID to update" },
          title: { type: "string", description: "New title" },
          description: { type: "string", description: "New description" },
          status: { type: "string", enum: ["active", "queued", "backlog"], description: "New status" },
          effort_estimate: { type: "number", enum: [1, 2, 3, 4] },
          drain_type: { type: "string", enum: ["deep", "comms", "admin", "creative", "easy"] },
        },
        required: ["move_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_move",
      description: "Mark a move as complete/done. Use search_moves first to find the move_id.",
      parameters: {
        type: "object",
        properties: {
          move_id: { type: "number", description: "The move ID" },
        },
        required: ["move_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_move",
      description: "Permanently delete a move. Use this to remove duplicate or cancelled tasks.",
      parameters: {
        type: "object",
        properties: {
          move_id: { type: "number", description: "The move ID to delete" },
        },
        required: ["move_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "promote_move",
      description: "Move a task from backlog to queued, or from queued to active.",
      parameters: {
        type: "object",
        properties: {
          move_id: { type: "number", description: "The move ID" },
          target: { type: "string", enum: ["active", "queued"], description: "Where to move it" },
        },
        required: ["move_id", "target"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "demote_move",
      description: "Move a task from active to queued, or from queued to backlog.",
      parameters: {
        type: "object",
        properties: {
          move_id: { type: "number", description: "The move ID" },
          target: { type: "string", enum: ["queued", "backlog"], description: "Where to move it" },
        },
        required: ["move_id", "target"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "suggest_next_move",
      description: "Suggest the best move to work on based on context.",
      parameters: {
        type: "object",
        properties: {
          time_available_minutes: { type: "number" },
          energy_level: { type: "string", enum: ["high", "medium", "low"] },
          context: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_avoidance_report",
      description:
        "Get a comprehensive avoidance behavior report. Shows stale clients, frequently deferred tasks, and behavioral patterns. Use this when asked about productivity issues, stale clients, or work avoidance.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_move_history",
      description:
        "Get the event history for a specific move. Shows all promotions, demotions, deferrals, and completions.",
      parameters: {
        type: "object",
        properties: {
          move_id: { type: "number", description: "The move ID to get history for" },
        },
        required: ["move_id"],
      },
    },
  },
]
