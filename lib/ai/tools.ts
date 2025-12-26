export const chatTools = [
  {
    type: "function" as const,
    function: {
      name: "get_all_client_pipelines",
      description: "Get pipeline status for ALL clients. Returns active/queued/backlog tasks for every client.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_tasks",
      description:
        "Search for tasks by title or client name. Use this FIRST to find the task ID before completing, updating, or deleting.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term to match against task titles" },
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
      name: "create_task",
      description:
        "Create a new task for a client. Infer drain_type: deep=focused technical work, shallow=emails/calls/coordination, admin=paperwork/documentation.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title - should be actionable and specific" },
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
          drain_type: {
            type: "string",
            enum: ["deep", "shallow", "admin"],
            description: "deep=focused work, shallow=comms/emails, admin=paperwork",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description: "Update an existing task's title, description, status, effort, or drain type.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID to update" },
          title: { type: "string", description: "New title" },
          description: { type: "string", description: "New description" },
          status: { type: "string", enum: ["active", "queued", "backlog"], description: "New status" },
          effort_estimate: { type: "number", enum: [1, 2, 3, 4] },
          drain_type: { type: "string", enum: ["deep", "shallow", "admin"] },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description: "Mark a task as complete/done. Use search_tasks first to find the task_id.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID" },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_task",
      description: "Permanently delete a task. Use this to remove duplicate or cancelled tasks.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID to delete" },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "promote_task",
      description: "Move a task from backlog to queued, or from queued to active.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID" },
          target: { type: "string", enum: ["active", "queued"], description: "Where to move it" },
        },
        required: ["task_id", "target"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "demote_task",
      description: "Move a task from active to queued, or from queued to backlog.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID" },
          target: { type: "string", enum: ["queued", "backlog"], description: "Where to move it" },
        },
        required: ["task_id", "target"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "suggest_next_task",
      description: "Suggest the best task to work on based on context.",
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
      name: "get_task_history",
      description:
        "Get the event history for a specific task. Shows all promotions, demotions, deferrals, and completions.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "number", description: "The task ID to get history for" },
        },
        required: ["task_id"],
      },
    },
  },
]
