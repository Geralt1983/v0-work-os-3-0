"use client"

import { useState } from "react"
import { useClientMemory, type ClientMemory } from "@/hooks/use-client-memory"
import { WorkOSNav } from "@/components/work-os-nav"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, Loader2, Check, Pencil, X } from "lucide-react"
import { cn } from "@/lib/utils"

const sentimentConfig = {
  positive: { label: "Positive", emoji: "😊", bgClass: "bg-emerald-500/10" },
  neutral: { label: "Neutral", emoji: "😐", bgClass: "" },
  challenging: { label: "Concerned", emoji: "😟", bgClass: "bg-amber-500/10" },
}

const importanceConfig = {
  high: { label: "High", color: "text-rose-400 border-rose-500/40 bg-rose-500/10" },
  medium: { label: "Medium", color: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
  low: { label: "Low", color: "text-zinc-400 border-zinc-500/40 bg-zinc-500/10" },
}

function getStalenessIndicator(days: number | null) {
  if (days === null) return { icon: null, color: "", label: "No activity" }
  if (days >= 4) return { icon: "🔴", color: "text-red-400", label: `${days} days ago` }
  if (days >= 2) return { icon: "⚠️", color: "text-amber-400", label: `${days} days ago` }
  return {
    icon: null,
    color: "text-white/60",
    label: days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`,
  }
}

function getProgressPercent(tasksThisWeek: number, importance: string) {
  // Expected tasks per week based on importance
  const expected = importance === "high" ? 10 : importance === "medium" ? 6 : 3
  return Math.min((tasksThisWeek / expected) * 100, 100)
}

export default function ClientsPage() {
  const { clients, isLoading, error, updateClientMemory } = useClientMemory()
  const [savingClient, setSavingClient] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [tempNotes, setTempNotes] = useState("")

  const handleFieldChange = async (clientName: string, field: keyof ClientMemory, value: any) => {
    setSavingClient(clientName)
    await updateClientMemory(clientName, { [field]: value })
    setSavingClient(null)
  }

  const startEditingNotes = (client: ClientMemory) => {
    setEditingNotes(client.clientName)
    setTempNotes(client.notes)
  }

  const saveNotes = async (clientName: string) => {
    setSavingClient(clientName)
    await updateClientMemory(clientName, { notes: tempNotes })
    setSavingClient(null)
    setEditingNotes(null)
  }

  const cancelEditingNotes = () => {
    setEditingNotes(null)
    setTempNotes("")
  }

  // Filter out internal clients (Revenue, General Admin)
  const externalClients = clients.filter((c) => !["Revenue", "General Admin"].includes(c.clientName))

  // Sort: high importance first, then by staleness
  const sortedClients = [...externalClients].sort((a, b) => {
    const importanceOrder = { high: 0, medium: 1, low: 2 }
    const impDiff = importanceOrder[a.importance] - importanceOrder[b.importance]
    if (impDiff !== 0) return impDiff
    // Then by staleness (most stale first)
    const aDays = a.daysSinceActivity ?? 999
    const bDays = b.daysSinceActivity ?? 999
    return bDays - aDays
  })

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 md:text-3xl">Clients</h1>
            <p className="hidden sm:block text-sm text-white/60 mt-1">Manage priorities and track client health</p>
          </div>
          <WorkOSNav />
        </div>

        <main className="mt-8 flex flex-col gap-8 pb-20">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">Failed to load clients</p>
              <p className="text-white/50 text-sm mt-1">{String(error)}</p>
            </div>
          ) : sortedClients.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No clients found</p>
              <p className="text-sm mt-2">Add clients from the Tasks page first</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sortedClients.map((client) => {
                const staleness = getStalenessIndicator(client.daysSinceActivity)
                const progress = getProgressPercent(client.tasksThisWeek, client.importance)
                const isEditing = editingNotes === client.clientName
                const isSaving = savingClient === client.clientName

                return (
                  <Card
                    key={client.clientId}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 transition-all duration-200",
                      "hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20",
                      sentimentConfig[client.sentiment].bgClass,
                    )}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: client.color || "#666" }}
                    />

                    <CardContent className="p-4 pl-5 space-y-4">
                      {/* Header row: Name + Priority badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: client.color || "#666" }}
                          />
                          <span className="font-semibold text-white">{client.clientName}</span>
                          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />}
                        </div>
                        <Badge variant="outline" className={cn("text-xs", importanceConfig[client.importance].color)}>
                          {importanceConfig[client.importance].label}
                        </Badge>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/70">
                          <span className="font-medium text-white">{client.tasksThisWeek}</span> tasks this week
                        </span>
                        <span className={cn("flex items-center gap-1", staleness.color)}>
                          {staleness.icon && <span>{staleness.icon}</span>}
                          Last: {staleness.label}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-white/40 text-right">{Math.round(progress)}% of weekly target</div>
                      </div>

                      {/* Inline dropdowns row */}
                      <div className="flex items-center gap-4">
                        {/* Importance dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50">Importance:</span>
                          <Select
                            value={client.importance}
                            onValueChange={(value) => handleFieldChange(client.clientName, "importance", value)}
                          >
                            <SelectTrigger className="h-7 w-24 bg-black/40 border-white/10 text-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                              <SelectItem value="high" className="text-white text-xs">
                                High
                              </SelectItem>
                              <SelectItem value="medium" className="text-white text-xs">
                                Medium
                              </SelectItem>
                              <SelectItem value="low" className="text-white text-xs">
                                Low
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Sentiment dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50">Sentiment:</span>
                          <Select
                            value={client.sentiment}
                            onValueChange={(value) => handleFieldChange(client.clientName, "sentiment", value)}
                          >
                            <SelectTrigger className="h-7 w-28 bg-black/40 border-white/10 text-white text-xs">
                              <SelectValue>
                                {sentimentConfig[client.sentiment].emoji} {sentimentConfig[client.sentiment].label}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                              <SelectItem value="positive" className="text-white text-xs">
                                😊 Positive
                              </SelectItem>
                              <SelectItem value="neutral" className="text-white text-xs">
                                😐 Neutral
                              </SelectItem>
                              <SelectItem value="challenging" className="text-white text-xs">
                                😟 Concerned
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Notes section */}
                      <div className="pt-2 border-t border-white/10">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Add notes about this client..."
                              className="bg-black/40 border-white/10 text-white placeholder:text-white/30 min-h-[60px] text-sm"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditingNotes}
                                className="h-7 text-xs text-white/60 hover:text-white"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => saveNotes(client.clientName)}
                                disabled={isSaving}
                                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                              >
                                {isSaving ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 mr-1" />
                                )}
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="group cursor-pointer flex items-start gap-2"
                            onClick={() => startEditingNotes(client)}
                          >
                            {client.notes ? (
                              <p className="text-sm text-white/70 flex-1 line-clamp-2">{client.notes}</p>
                            ) : (
                              <p className="text-sm text-white/30 italic flex-1">Add notes...</p>
                            )}
                            <Pencil className="h-3 w-3 text-white/30 group-hover:text-white/60 flex-shrink-0 mt-1" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
