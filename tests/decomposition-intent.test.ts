import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isDecompositionIntent, shouldForceDecompositionWorkflow } from "@/lib/ai/decomposition-intent"

describe("decomposition intent detection", () => {
  it("detects direct decomposition requests", () => {
    assert.equal(isDecompositionIntent("Break this task down into subtasks"), true)
    assert.equal(isDecompositionIntent("Can you make an execution plan for this?"), true)
    assert.equal(isDecompositionIntent("what is my pipeline status"), false)
  })

  it("forces workflow on follow-up turns when prior planning context exists", () => {
    const force = shouldForceDecompositionWorkflow({
      latestUserMessage: "yes, for the citrix one",
      recentTurns: [
        { role: "user", content: "Can you break this down into steps?" },
        { role: "assistant", content: "I can decompose it into subtasks." },
      ],
      retrievedTurns: [],
    })
    assert.equal(force, true)
  })

  it("forces workflow on direct decomposition path even without prior context", () => {
    const force = shouldForceDecompositionWorkflow({
      latestUserMessage: "make an implementation plan for the migration",
      recentTurns: [],
      retrievedTurns: [],
    })
    assert.equal(force, true)
  })

  it("uses retrieved turns to continue decomposition workflow across context gaps", () => {
    const force = shouldForceDecompositionWorkflow({
      latestUserMessage: "do it",
      recentTurns: [{ role: "assistant", content: "What should we do next?" }],
      retrievedTurns: [{ role: "user", content: "Please create an implementation plan for EHR rollout" }],
    })
    assert.equal(force, true)
  })

  it("does not force workflow without planning context", () => {
    const force = shouldForceDecompositionWorkflow({
      latestUserMessage: "show me active tasks",
      recentTurns: [{ role: "assistant", content: "Ready." }],
      retrievedTurns: [],
    })
    assert.equal(force, false)
  })
})
