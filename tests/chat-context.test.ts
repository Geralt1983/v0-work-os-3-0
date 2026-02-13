import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildDecompositionRagContext, buildMergedContextBlock, pickRetrievedHistory } from "@/lib/ai/chat-context"

describe("chat context merging", () => {
  it("carries forward recent context and last assistant question", () => {
    const history = [
      { role: "assistant", content: "What should we prioritize next?" },
      { role: "user", content: "The Citrix migration risk tracker." },
      { role: "assistant", content: "Understood." },
    ]

    const merged = buildMergedContextBlock({
      history,
      latestUserMessage: "yes, do that",
      avoidanceContext: "",
    })

    assert.equal(merged.recentTurns.length, 3)
    assert.match(merged.text, /Last assistant question: What should we prioritize next\?/)
    assert.match(merged.text, /Recent conversation:/)
  })

  it("retrieves older relevant turns for follow-up RAG continuity", () => {
    const older = [
      { role: "user", content: "Please build an implementation plan for EHR rollout with milestones" },
      { role: "assistant", content: "I can break that into subtasks." },
      { role: "user", content: "Random unrelated update" },
    ]

    const retrieved = pickRetrievedHistory(older, "do it for the EHR rollout milestones")

    assert.ok(retrieved.some((turn) => /implementation plan for EHR rollout/i.test(turn.content)))
  })

  it("falls back to recency retrieval for terse follow-ups", () => {
    const older = [
      { role: "user", content: "Context A" },
      { role: "assistant", content: "Context B" },
      { role: "user", content: "Context C" },
    ]

    const retrieved = pickRetrievedHistory(older, "do it")

    assert.equal(retrieved.length, 3)
    assert.equal(retrieved[0]?.content, "Context A")
    assert.equal(retrieved[2]?.content, "Context C")
  })

  it("supports notebook-specific routing", () => {
    const history = [
      { role: "user", content: "Family dentist appointment follow-up", notebookId: "personal" },
      { role: "assistant", content: "I can help manage your personal errands.", notebookId: "personal" },
      { role: "user", content: "EHR rollout milestones for Citrix client", notebookId: "work" },
      { role: "assistant", content: "Let's break down the work implementation plan.", notebookId: "work" },
    ]

    const merged = buildMergedContextBlock({
      history,
      latestUserMessage: "what did we decide before?",
      avoidanceContext: "",
      routing: { mode: "specific", notebookId: "work" },
    })

    assert.equal(merged.routing.mode, "specific")
    assert.deepEqual(merged.routing.selectedNotebookIds, ["work"])
    assert.ok(merged.text.includes("mode=specific"))
  })

  it("auto-routes to best matching notebooks from candidates", () => {
    const history = [
      { role: "user", content: "Family grocery list and doctor appointment", notebookId: "personal" },
      { role: "assistant", content: "Personal tasks captured.", notebookId: "personal" },
      { role: "user", content: "Citrix implementation deliverables and milestones", notebookId: "work" },
      { role: "assistant", content: "Work plan captured.", notebookId: "work" },
    ]

    const merged = buildMergedContextBlock({
      history,
      latestUserMessage: "update implementation milestones",
      avoidanceContext: "",
      routing: { mode: "auto", candidateNotebookIds: ["personal", "work"] },
    })

    assert.equal(merged.routing.mode, "auto")
    assert.equal(merged.routing.selectedNotebookIds[0], "work")
    assert.ok(merged.routing.notebookScores.some((score) => score.notebookId === "work"))
  })

  it("builds decomposition rag context from recent + retrieved turns for selected notebooks", () => {
    const history = [
      { role: "user", content: "EHR rollout milestones for Citrix client", notebookId: "work" },
      { role: "assistant", content: "Let's break down the work implementation plan.", notebookId: "work" },
      { role: "user", content: "Draft migration doc", notebookId: "work" },
      { role: "assistant", content: "Captured", notebookId: "work" },
      { role: "user", content: "Confirm owners", notebookId: "work" },
      { role: "assistant", content: "Captured", notebookId: "work" },
      { role: "user", content: "Share timeline", notebookId: "work" },
      { role: "assistant", content: "Captured", notebookId: "work" },
      { role: "user", content: "Track blockers", notebookId: "work" },
      { role: "assistant", content: "Captured", notebookId: "work" },
      { role: "user", content: "Update dependencies", notebookId: "work" },
      { role: "user", content: "Need more detail on implementation sequencing", notebookId: "work" },
      { role: "user", content: "Family grocery list and doctor appointment", notebookId: "personal" },
      { role: "assistant", content: "Personal tasks captured.", notebookId: "personal" },
    ]

    const merged = buildMergedContextBlock({
      history,
      latestUserMessage: "do it",
      avoidanceContext: "",
      routing: { mode: "specific", notebookId: "work" },
    })

    const ragContext = buildDecompositionRagContext({
      latestUserMessage: "do it",
      recentTurns: merged.recentTurns,
      retrievedTurns: merged.retrievedTurns,
      routing: merged.routing,
    })

    assert.match(ragContext, /Selected notebooks: work/)
    assert.match(ragContext, /Recent thread context:/)
    assert.match(ragContext, /Retrieved notebook context:/)
    assert.match(ragContext, /EHR rollout milestones for Citrix client/i)
  })
})
