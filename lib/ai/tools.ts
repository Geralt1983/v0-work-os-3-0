export const chatTools = [
  {
    type: "function" as const,
    function: {
      name: "decompose_task",
      description:
        "Break a task into concrete subtasks. Mandatory first step when user asks to break down, plan, or sequence work, including follow-up planning turns.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Task text, title, or reference to decompose",
          },
          max_subtasks: {
            type: "number",
            enum: [2, 3, 4, 5, 6],
            description: "Optional number of subtasks to return (default: 4)",
          },
          rag_context: {
            type: "string",
            description: "Optional retrieved context from prior conversation for follow-up continuity",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_all_client_pipelines",
      description:
        "Get pipeline status for ALL clients. Use first for portfolio/status questions so you can answer decisively from live data.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_tasks",
      description:
        "Search tasks by title/client for disambiguation. Use this before asking clarifying questions when a lookup can resolve IDs or exact matches.",
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
        "Create a new WorkOS task immediately when user intent is to add work. Infer drain_type: deep=focused technical work, shallow=emails/calls/coordination, admin=paperwork/documentation.",
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
      description:
        "Update an existing task's title, description, status, effort, or drain type. If task identity is unclear, run search_tasks first instead of asking immediately.",
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
      description:
        "Mark a task as complete/done. Use search_tasks first to resolve task_id, then complete without extra clarification when match is unambiguous.",
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
      description:
        "Permanently delete a task. Use search_tasks first to resolve task_id when needed, then execute decisively if there is one clear match.",
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
      description:
        "Move a task from backlog to queued, or from queued to active. Prefer executing movement over discussing movement.",
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
      description:
        "Move a task from active to queued, or from queued to backlog. Prefer executing movement over discussing movement.",
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
      description:
        "Suggest the best task to work on based on live pipeline context. Use for 'what should I do' requests instead of generic advice.",
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
        "Get a comprehensive avoidance behavior report. Shows stale clients, frequently deferred tasks, and behavioral patterns. Use this first for productivity/avoidance questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_task_history",
      description:
        "Get the event history for a specific task. Shows promotions, demotions, deferrals, and completions. Use this to answer timeline questions from records, not memory.",
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
