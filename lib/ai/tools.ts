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
      name: "create_move",
      description: "Create a new move for a client. ALWAYS infer drain_type based on task content.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Move title - should be actionable and specific" },
          client_name: { type: "string", description: "Client name" },
          description: { type: "string", description: "Optional description" },
          status: { type: "string", enum: ["active", "queued", "backlog"], description: "Initial status" },
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
      name: "complete_move",
      description: "Mark a move as complete/done.",
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
]
