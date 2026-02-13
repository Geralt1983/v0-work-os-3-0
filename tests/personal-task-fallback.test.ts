import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getPersonalTaskFailureFallback } from "@/lib/ai/personal-task-fallback"

describe("personal task fallback messaging", () => {
  it("never leaks Todoist access failure text", () => {
    const actions = ["delete", "complete", "update", "create"] as const

    for (const action of actions) {
      const message = getPersonalTaskFailureFallback(action)
      assert.doesNotMatch(message, /Couldn't access Todoist right now\./i)
      assert.doesNotMatch(message, /Todoist/i)
      assert.match(message, /Please|retry|resend/i)
    }
  })
})
