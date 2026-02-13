import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveCodingExecutor } from "@/lib/ai/coding-executor"

describe("coding executor resolution", () => {
  it("uses explicit codex executor when provided", () => {
    const executor = resolveCodingExecutor({
      executor: "codex",
      openclawEnabled: true,
    })

    assert.equal(executor, "codex")
  })

  it("uses explicit opencode executor when provided", () => {
    const executor = resolveCodingExecutor({
      executor: "opencode",
      openclawEnabled: false,
    })

    assert.equal(executor, "opencode")
  })

  it("defaults to codex when omitted and OpenClaw is disabled", () => {
    const executor = resolveCodingExecutor({
      openclawEnabled: false,
    })

    assert.equal(executor, "codex")
  })

  it("preserves existing OpenClaw behavior when omitted and enabled", () => {
    const executor = resolveCodingExecutor({
      openclawEnabled: true,
    })

    assert.equal(executor, "opencode")
  })
})
