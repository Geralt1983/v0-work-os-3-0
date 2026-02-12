import assert from "node:assert/strict"
import { describe, it } from "node:test"

type Category =
  | "create"
  | "search"
  | "status"
  | "prioritize"
  | "complete"
  | "update"
  | "delete"
  | "voice"
  | "edge"

type ToolName =
  | "get_all_client_pipelines"
  | "search_tasks"
  | "create_task"
  | "update_task"
  | "complete_task"
  | "delete_task"
  | "suggest_next_task"

type ToolCall = {
  tool: ToolName
  args: Record<string, unknown>
}

type PromptCase = {
  category: Category
  prompt: string
  expectToolCall: boolean
  expectedFirstTool?: ToolName
  expectedSecondTool?: ToolName
}

type SynapseResult = {
  response: string
  toolCalls: ToolCall[]
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

class MockToolExecutor {
  calls: ToolCall[] = []

  async execute(tool: ToolName, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.calls.push({ tool, args })

    switch (tool) {
      case "search_tasks":
        return {
          tasks: [{ id: 42, title: String(args.query || "unknown task"), status: "backlog" }],
          total: 1,
        }
      case "create_task":
        return { success: true, task: { id: 101, title: String(args.title || "new task"), status: "backlog" } }
      case "complete_task":
        return { success: true, message: `Completed #${String(args.task_id || 42)}` }
      case "update_task":
        return { success: true, task: { id: args.task_id || 42, title: String(args.title || "updated task") } }
      case "delete_task":
        return { success: true, message: `Deleted #${String(args.task_id || 42)}` }
      case "get_all_client_pipelines":
        return { pipelines: [{ clientName: "Acme", active: [{ id: 1 }], queued: [{ id: 2 }], backlog: [{ id: 3 }] }] }
      case "suggest_next_task":
        return { suggestion: { id: 7, title: "Ship the inevitable milestone" } }
      default:
        return { ok: true }
    }
  }
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g)
  return matches ? matches.length : 1
}

function isThanosVoice(text: string): boolean {
  const lower = text.toLowerCase()
  const markers = ["inevitable", "titan", "stone", "balance", "cosmic"]
  return markers.some((m) => lower.includes(m))
}

function extractId(text: string): number | null {
  const match = text.match(/#(\d{1,6})\b/)
  if (!match) return null
  return Number(match[1])
}

function extractQueryAfterVerb(text: string): string {
  const cleaned = text
    .replace(/^(please|can you|could you|hey)\s+/i, "")
    .replace(/\b(in thanos voice|as thanos)\b/gi, "")
    .trim()
  const match = cleaned.match(
    /(?:add|create|new|search|find|lookup|look up|complete|finish|rename|update|change|delete|remove|drop)\s+(.+)/i,
  )
  return (match?.[1] || cleaned).replace(/[?.!]+$/g, "").trim()
}

async function runSynapse(prompt: string, executor: MockToolExecutor): Promise<SynapseResult> {
  const lower = prompt.toLowerCase()
  const greeting = /^(hi|hello|hey|thanks|thank you)\b/.test(lower.trim())
  const id = extractId(prompt)

  if (greeting) {
    return { response: "Cosmic silence acknowledged. State your objective.", toolCalls: executor.calls }
  }

  if (/\b(what should i do|prioritize|next task)\b/.test(lower)) {
    await executor.execute("suggest_next_task", {})
    return { response: "Inevitable move: tackle task #7 now. Titan balance favors momentum.", toolCalls: executor.calls }
  }

  if (/\b(add|create|new)\b/.test(lower)) {
    await executor.execute("create_task", { title: extractQueryAfterVerb(prompt), status: "backlog" })
    return { response: "The Titan forged it into backlog. Progress is inevitable.", toolCalls: executor.calls }
  }

  if (/\b(complete|finish|check off|done)\b/.test(lower)) {
    if (id) {
      await executor.execute("complete_task", { task_id: id })
    } else {
      const query = extractQueryAfterVerb(prompt)
      await executor.execute("search_tasks", { query })
      await executor.execute("complete_task", { task_id: 42 })
    }
    return { response: "Task erased from the battlefield. Balance restored.", toolCalls: executor.calls }
  }

  if (/\b(rename|update|change)\b/.test(lower)) {
    const toMatch = prompt.match(/\bto\s+(.+)$/i)
    const newTitle = (toMatch?.[1] || "updated task").replace(/[?.!]+$/g, "")
    if (id) {
      await executor.execute("update_task", { task_id: id, title: newTitle })
    } else {
      await executor.execute("search_tasks", { query: extractQueryAfterVerb(prompt) })
      await executor.execute("update_task", { task_id: 42, title: newTitle })
    }
    return { response: "Reality rewritten. The new title stands inevitable.", toolCalls: executor.calls }
  }

  if (/\b(delete|remove|drop)\b/.test(lower)) {
    if (id) {
      await executor.execute("delete_task", { task_id: id })
    } else {
      await executor.execute("search_tasks", { query: extractQueryAfterVerb(prompt) })
      await executor.execute("delete_task", { task_id: 42 })
    }
    return { response: "I snapped that task from existence. Cosmic clutter reduced.", toolCalls: executor.calls }
  }

  if (/\b(search|find|lookup|look up)\b/.test(lower)) {
    await executor.execute("search_tasks", { query: extractQueryAfterVerb(prompt) })
    return { response: "Cosmic scan complete. One trail found in the stars.", toolCalls: executor.calls }
  }

  if (/\b(status|pipeline|active|queued|backlog|how many tasks)\b/.test(lower)) {
    await executor.execute("get_all_client_pipelines", {})
    return { response: "I read the cosmic board: 1 active, 1 queued, 1 backlog. Keep the balance.", toolCalls: executor.calls }
  }

  return { response: "The Titan sees static. Give one concrete objective.", toolCalls: executor.calls }
}

function buildPromptCases(seed = 4242): PromptCase[] {
  const rand = mulberry32(seed)

  const workloads = ["SOW draft", "Citrix migration", "invoice follow-up", "EHR rollout", "status memo", "QA checklist"]
  const verbs = ["please", "quick", "right now", "today", "this afternoon"]
  const statuses = ["active", "queued", "backlog"]

  const out: PromptCase[] = []

  for (let i = 0; i < 7; i++) {
    out.push({
      category: "create",
      prompt: `${pick(rand, ["create", "add", "new"])} ${pick(rand, workloads)} ${pick(rand, verbs)}`.trim(),
      expectToolCall: true,
      expectedFirstTool: "create_task",
    })
  }

  for (let i = 0; i < 6; i++) {
    out.push({
      category: "search",
      prompt: `${pick(rand, ["search", "find", "look up"])} ${pick(rand, workloads)} tasks`,
      expectToolCall: true,
      expectedFirstTool: "search_tasks",
    })
  }

  for (let i = 0; i < 6; i++) {
    out.push({
      category: "status",
      prompt: `show ${pick(rand, ["pipeline", "status"])} for ${pick(rand, statuses)} tasks`,
      expectToolCall: true,
      expectedFirstTool: "get_all_client_pipelines",
    })
  }

  for (let i = 0; i < 6; i++) {
    out.push({
      category: "prioritize",
      prompt: pick(rand, ["what should I do next", "prioritize my next move", "next task now"]),
      expectToolCall: true,
      expectedFirstTool: "suggest_next_task",
    })
  }

  for (let i = 0; i < 7; i++) {
    const withId = rand() > 0.5
    out.push({
      category: "complete",
      prompt: withId
        ? `${pick(rand, ["complete", "finish", "check off"])} #${100 + i}`
        : `${pick(rand, ["complete", "finish"])} ${pick(rand, workloads)}`,
      expectToolCall: true,
      expectedFirstTool: withId ? "complete_task" : "search_tasks",
      expectedSecondTool: withId ? undefined : "complete_task",
    })
  }

  for (let i = 0; i < 6; i++) {
    const withId = rand() > 0.5
    out.push({
      category: "update",
      prompt: withId
        ? `${pick(rand, ["rename", "update", "change"])} #${200 + i} to ${pick(rand, workloads)} v2`
        : `${pick(rand, ["rename", "change"])} ${pick(rand, workloads)} to ${pick(rand, workloads)} v2`,
      expectToolCall: true,
      expectedFirstTool: withId ? "update_task" : "search_tasks",
      expectedSecondTool: withId ? undefined : "update_task",
    })
  }

  for (let i = 0; i < 6; i++) {
    const withId = rand() > 0.5
    out.push({
      category: "delete",
      prompt: withId ? `${pick(rand, ["delete", "remove", "drop"])} #${300 + i}` : `${pick(rand, ["delete", "remove"])} ${pick(rand, workloads)}`,
      expectToolCall: true,
      expectedFirstTool: withId ? "delete_task" : "search_tasks",
      expectedSecondTool: withId ? undefined : "delete_task",
    })
  }

  for (let i = 0; i < 3; i++) {
    const request = pick(rand, ["what should I do next", "show pipeline status"])
    out.push({
      category: "voice",
      prompt: `${pick(rand, ["in Thanos voice", "as Thanos"])} ${request}`,
      expectToolCall: true,
      expectedFirstTool: request.includes("what should I do next") ? "suggest_next_task" : "get_all_client_pipelines",
    })
  }

  out.push(
    { category: "edge", prompt: "hello", expectToolCall: false },
    { category: "edge", prompt: "thanks", expectToolCall: false },
    { category: "edge", prompt: "   ???   ", expectToolCall: false },
  )

  return out
}

describe("synapse randomized prompts", () => {
  const promptCases = buildPromptCases()

  it("builds exactly 50 prompt cases with all required categories", () => {
    assert.equal(promptCases.length, 50)
    const categories = new Set(promptCases.map((c) => c.category))
    assert.equal(categories.has("create"), true)
    assert.equal(categories.has("search"), true)
    assert.equal(categories.has("status"), true)
    assert.equal(categories.has("prioritize"), true)
    assert.equal(categories.has("complete"), true)
    assert.equal(categories.has("update"), true)
    assert.equal(categories.has("delete"), true)
    assert.equal(categories.has("voice"), true)
    assert.equal(categories.has("edge"), true)
  })

  for (const [index, c] of promptCases.entries()) {
    it(`case ${index + 1} [${c.category}] enforces tool-first + Thanos voice + concise response`, async () => {
      const executor = new MockToolExecutor()
      const result = await runSynapse(c.prompt, executor)

      if (c.expectToolCall) {
        assert.ok(result.toolCalls.length > 0)
        if (c.expectedFirstTool) {
          assert.equal(result.toolCalls[0]?.tool, c.expectedFirstTool)
        }
        if (c.expectedSecondTool) {
          assert.equal(result.toolCalls[1]?.tool, c.expectedSecondTool)
        }
      } else {
        assert.equal(result.toolCalls.length, 0)
      }

      assert.equal(isThanosVoice(result.response), true)
      assert.ok(countSentences(result.response) <= 2)
      assert.ok(result.response.split(/\s+/).filter(Boolean).length <= 24)
    })
  }
})
