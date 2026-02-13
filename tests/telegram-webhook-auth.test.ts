import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { POST } from "../app/api/integrations/telegram/webhook/route"

describe("telegram webhook auth", () => {
  it("returns 401 when TELEGRAM_WEBHOOK_SECRET is missing (and does not fall back to body parsing)", async () => {
    const prev = process.env.TELEGRAM_WEBHOOK_SECRET
    try {
      delete process.env.TELEGRAM_WEBHOOK_SECRET

      // Body is intentionally invalid JSON. If the handler tried to parse it before auth,
      // it would return 200 { ok:true } (existing behavior). We expect 401 instead.
      const req = new Request("http://localhost/api/integrations/telegram/webhook", {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json" },
      })

      const res = await POST(req)
      assert.equal(res.status, 401)
      assert.deepEqual(await res.json(), { ok: false })
    } finally {
      if (prev === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET
      else process.env.TELEGRAM_WEBHOOK_SECRET = prev
    }
  })

  it("returns 401 when TELEGRAM_WEBHOOK_SECRET mismatches header token", async () => {
    const prev = process.env.TELEGRAM_WEBHOOK_SECRET
    try {
      process.env.TELEGRAM_WEBHOOK_SECRET = "expected"

      const req = new Request("http://localhost/api/integrations/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: 1 }, text: "hi" } }),
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "wrong",
        },
      })

      const res = await POST(req)
      assert.equal(res.status, 401)
      assert.deepEqual(await res.json(), { ok: false })
    } finally {
      if (prev === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET
      else process.env.TELEGRAM_WEBHOOK_SECRET = prev
    }
  })

  it("keeps existing behavior for invalid JSON when auth passes (returns 200 ok:true)", async () => {
    const prev = process.env.TELEGRAM_WEBHOOK_SECRET
    try {
      process.env.TELEGRAM_WEBHOOK_SECRET = "expected"

      const req = new Request("http://localhost/api/integrations/telegram/webhook", {
        method: "POST",
        body: "not-json",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "expected",
        },
      })

      const res = await POST(req)
      assert.equal(res.status, 200)
      assert.deepEqual(await res.json(), { ok: true })
    } finally {
      if (prev === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET
      else process.env.TELEGRAM_WEBHOOK_SECRET = prev
    }
  })
})
