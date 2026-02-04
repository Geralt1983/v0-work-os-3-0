"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const ASSISTANT_NAME = "ThanosAI"

type RewriteContext = {
  client?: string
  type?: string
  timebox_minutes?: number
}

type RewriteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalText: string
  context?: RewriteContext
  onAccept: (rewritten: string) => void
}

export function RewriteDialog({ open, onOpenChange, originalText, context, onAccept }: RewriteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState("")

  async function fetchRewrite() {
    setLoading(true)
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText, context }),
      })
      const data = await res.json()
      setSuggestion(data.rewrite)
    } finally {
      setLoading(false)
    }
  }

  // Fetch suggestion when dialog opens
  useEffect(() => {
    if (open && !suggestion && !loading) {
      void fetchRewrite()
    }
    // Reset when dialog closes
    if (!open) {
      setSuggestion("")
    }
  }, [open])

  function handleAccept() {
    if (!suggestion) return
    onAccept(suggestion)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl bg-zinc-950 border border-zinc-800 p-6">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">Rewrite with {ASSISTANT_NAME}</DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            Here is a clearer version. Replace your text or keep the original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-[0.18em] font-semibold">Original</div>
          <Textarea
            value={originalText}
            readOnly
            className="h-20 bg-zinc-900 border-zinc-800 text-zinc-400 text-sm resize-none rounded-xl"
          />

          <div className="text-[10px] text-zinc-500 uppercase tracking-[0.18em] font-semibold mt-4">
            Suggested by {ASSISTANT_NAME}
          </div>
          <Textarea
            value={loading ? `${ASSISTANT_NAME} is rewriting...` : suggestion}
            readOnly
            className="h-32 bg-zinc-900 border-zinc-800 text-zinc-100 text-sm resize-none rounded-xl"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full px-4 text-zinc-400 hover:text-zinc-200"
          >
            Keep original
          </Button>
          <Button
            type="button"
            disabled={loading || !suggestion}
            onClick={handleAccept}
            className="rounded-full px-4 bg-white text-black hover:bg-zinc-200"
          >
            Replace text
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
