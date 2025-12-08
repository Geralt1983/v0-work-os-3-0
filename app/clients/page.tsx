"use client"

import { useState } from "react"
import { useClientMemory, type ClientMemory } from "@/hooks/use-client-memory"
import { WorkOSNav } from "@/components/work-os-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Moon,
  ThumbsUp,
  Meh,
  ThumbsDown,
  Save,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const tierConfig = {
  active: { label: "Active", icon: Zap, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  maintenance: { label: "Maintenance", icon: Sparkles, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  dormant: { label: "Dormant", icon: Moon, color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30" },
}

const sentimentConfig = {
  positive: { label: "Positive", icon: ThumbsUp, color: "text-emerald-400" },
  neutral: { label: "Neutral", icon: Meh, color: "text-zinc-400" },
  challenging: { label: "Challenging", icon: ThumbsDown, color: "text-rose-400" },
}

const importanceConfig = {
  high: { label: "High", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  medium: { label: "Medium", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  low: { label: "Low", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
}

export default function ClientsPage() {
  const { clients, isLoading, error, updateClientMemory } = useClientMemory()
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [savingClient, setSavingClient] = useState<string | null>(null)
  const [editedClients, setEditedClients] = useState<Record<string, Partial<ClientMemory>>>({})

  const handleFieldChange = (clientName: string, field: keyof ClientMemory, value: any) => {
    setEditedClients((prev) => ({
      ...prev,
      [clientName]: {
        ...prev[clientName],
        [field]: value,
      },
    }))
  }

  const handleSave = async (clientName: string) => {
    const updates = editedClients[clientName]
    if (!updates) return

    setSavingClient(clientName)
    const success = await updateClientMemory(clientName, updates)
    setSavingClient(null)

    if (success) {
      // Clear edited state for this client
      setEditedClients((prev) => {
        const next = { ...prev }
        delete next[clientName]
        return next
      })
    }
  }

  const getClientValue = (client: ClientMemory, field: keyof ClientMemory) => {
    return editedClients[client.clientName]?.[field] ?? client[field]
  }

  const hasUnsavedChanges = (clientName: string) => {
    return !!editedClients[clientName] && Object.keys(editedClients[clientName]).length > 0
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {/* Header with navigation */}
      <div className="flex-none mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 md:text-3xl">Clients</h1>
            <p className="hidden sm:block text-sm text-white/60 mt-1">Manage client priorities and settings</p>
          </div>
          <div className="flex-shrink-0 pt-1">
            <WorkOSNav />
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">Failed to load clients</p>
            <p className="text-white/50 text-sm mt-1">{String(error)}</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No clients found</p>
            <p className="text-sm mt-2">Add clients from the Moves page first</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sort clients: high importance first, then by tier */}
            {[...clients]
              .sort((a, b) => {
                const importanceOrder = { high: 0, medium: 1, low: 2 }
                const tierOrder = { active: 0, maintenance: 1, dormant: 2 }
                const impDiff = importanceOrder[a.importance] - importanceOrder[b.importance]
                if (impDiff !== 0) return impDiff
                return tierOrder[a.tier] - tierOrder[b.tier]
              })
              .map((client) => {
                const isExpanded = expandedClient === client.clientName
                const tier = getClientValue(client, "tier") as ClientMemory["tier"]
                const sentiment = getClientValue(client, "sentiment") as ClientMemory["sentiment"]
                const importance = getClientValue(client, "importance") as ClientMemory["importance"]
                const notes = getClientValue(client, "notes") as string
                const TierIcon = tierConfig[tier].icon
                const SentimentIcon = sentimentConfig[sentiment].icon

                return (
                  <Card
                    key={client.clientId}
                    className={cn(
                      "bg-zinc-900/50 border-white/10 transition-all",
                      isExpanded && "border-fuchsia-500/30",
                    )}
                  >
                    <CardHeader
                      className="cursor-pointer py-4"
                      onClick={() => setExpandedClient(isExpanded ? null : client.clientName)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: client.color || "#666" }} />
                          <CardTitle className="text-lg font-medium text-white">{client.clientName}</CardTitle>
                          <Badge variant="outline" className={cn("text-xs", importanceConfig[importance].color)}>
                            {importanceConfig[importance].label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs",
                              tierConfig[tier].color,
                            )}
                          >
                            <TierIcon className="h-3.5 w-3.5" />
                            {tierConfig[tier].label}
                          </div>
                          <SentimentIcon className={cn("h-4 w-4", sentimentConfig[sentiment].color)} />
                          {hasUnsavedChanges(client.clientName) && (
                            <div className="h-2 w-2 rounded-full bg-amber-400" />
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-white/50" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-white/50" />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 space-y-4">
                        {/* Tier */}
                        <div className="grid grid-cols-3 gap-4">
                          {/* Tier */}
                          <div className="space-y-2">
                            <label className="text-xs text-white/50 uppercase tracking-wide">Tier</label>
                            <Select
                              value={tier}
                              onValueChange={(value) => handleFieldChange(client.clientName, "tier", value)}
                            >
                              <SelectTrigger className="bg-black/40 border-white/10 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-white/10">
                                <SelectItem value="active" className="text-white">
                                  Active
                                </SelectItem>
                                <SelectItem value="maintenance" className="text-white">
                                  Maintenance
                                </SelectItem>
                                <SelectItem value="dormant" className="text-white">
                                  Dormant
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Importance */}
                          <div className="space-y-2">
                            <label className="text-xs text-white/50 uppercase tracking-wide">Importance</label>
                            <Select
                              value={importance}
                              onValueChange={(value) => handleFieldChange(client.clientName, "importance", value)}
                            >
                              <SelectTrigger className="bg-black/40 border-white/10 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-white/10">
                                <SelectItem value="high" className="text-white">
                                  High
                                </SelectItem>
                                <SelectItem value="medium" className="text-white">
                                  Medium
                                </SelectItem>
                                <SelectItem value="low" className="text-white">
                                  Low
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Sentiment */}
                          <div className="space-y-2">
                            <label className="text-xs text-white/50 uppercase tracking-wide">Sentiment</label>
                            <Select
                              value={sentiment}
                              onValueChange={(value) => handleFieldChange(client.clientName, "sentiment", value)}
                            >
                              <SelectTrigger className="bg-black/40 border-white/10 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-white/10">
                                <SelectItem value="positive" className="text-white">
                                  Positive
                                </SelectItem>
                                <SelectItem value="neutral" className="text-white">
                                  Neutral
                                </SelectItem>
                                <SelectItem value="challenging" className="text-white">
                                  Challenging
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                          <label className="text-xs text-white/50 uppercase tracking-wide">Notes</label>
                          <Textarea
                            value={notes}
                            onChange={(e) => handleFieldChange(client.clientName, "notes", e.target.value)}
                            placeholder="Add notes about this client..."
                            className="bg-black/40 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
                          />
                        </div>

                        {/* Save button */}
                        {hasUnsavedChanges(client.clientName) && (
                          <div className="flex justify-end">
                            <Button
                              onClick={() => handleSave(client.clientName)}
                              disabled={savingClient === client.clientName}
                              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                            >
                              {savingClient === client.clientName ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Save Changes
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
          </div>
        )}
      </main>
    </div>
  )
}
