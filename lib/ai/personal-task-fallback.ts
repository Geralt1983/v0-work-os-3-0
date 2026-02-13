export type PersonalTaskActionType = "delete" | "complete" | "update" | "create"

export function getPersonalTaskFailureFallback(actionType: PersonalTaskActionType): string {
  switch (actionType) {
    case "delete":
      return "I couldn't remove that personal task just now. Please share the exact title and I'll retry."
    case "complete":
      return "I couldn't mark that personal task as done just now. Please share the exact title and I'll retry."
    case "update":
      return "I couldn't update that personal task just now. Please share the exact title and the new wording, and I'll retry."
    case "create":
      return "I couldn't add that personal task just now. Please resend it and I'll retry."
  }
}

export function logPersonalTaskToolFailure(actionType: PersonalTaskActionType, err: unknown): void {
  const detail = err instanceof Error ? err.message : String(err)
  console.error("[chat] Personal task tool failure", { actionType, detail })
}
