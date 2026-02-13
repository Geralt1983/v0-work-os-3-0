import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveIngestionRoute } from "@/lib/ai/ingestion-routing"

describe("ingestion routing", () => {
  it("classifies Telegram content into notebook keys", () => {
    const route = resolveIngestionRoute({
      source: "telegram",
      content: "Need to finalize Citrix client rollout milestones this week",
      sourceMetadata: {
        chatTitle: "Delivery Team",
      },
    })

    assert.equal(route.notebookId, "work")
    assert.equal(route.source, "telegram")
    assert.equal(route.sourceMetadata.source, "telegram")
    assert.equal(route.routing.explicit, false)
    assert.ok(route.routing.confidence > 0 && route.routing.confidence <= 1)
  })

  it("uses explicit notebook key when provided", () => {
    const route = resolveIngestionRoute({
      source: "telegram",
      notebookId: "ops-notes",
      content: "Family grocery list update",
    })

    assert.equal(route.notebookId, "ops-notes")
    assert.equal(route.routing.explicit, true)
    assert.equal(route.routing.confidence, 1)
  })

  it("classifies Google Drive documents by content and metadata", () => {
    const route = resolveIngestionRoute({
      source: "google_drive",
      content: "Doctor appointment notes and family follow-up tasks",
      sourceMetadata: {
        folder: "Personal Admin",
      },
    })

    assert.equal(route.notebookId, "personal")
    assert.equal(route.source, "google_drive")
    assert.equal(route.routing.explicit, false)
  })
})
