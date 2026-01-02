"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Palmtree, Plus, Trash2, Calendar, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface HolidayInfo {
  id: number
  date: string
  description: string | null
}

interface HolidayManagerProps {
  className?: string
}

export function HolidayManager({ className }: HolidayManagerProps) {
  const { data, isLoading } = useSWR("/api/holidays", fetcher)
  const [newDate, setNewDate] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const holidays: HolidayInfo[] = data?.holidays ?? []
  const isTodayHoliday = data?.isTodayHoliday ?? false

  const handleAddHoliday = async () => {
    if (!newDate) return

    setIsAdding(true)
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newDate,
          description: newDescription || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to add holiday")
      }

      // Reset form and refresh data
      setNewDate("")
      setNewDescription("")
      mutate("/api/holidays")
    } catch (err) {
      console.error("Failed to add holiday:", err)
      alert(err instanceof Error ? err.message : "Failed to add holiday")
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteHoliday = async (id: number) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/holidays/${id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete holiday")
      }

      mutate("/api/holidays")
    } catch (err) {
      console.error("Failed to delete holiday:", err)
      alert("Failed to delete holiday")
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const isToday = (dateStr: string) => {
    const today = new Date()
    const [year, month, day] = dateStr.split("-").map(Number)
    return (
      today.getFullYear() === year &&
      today.getMonth() === month - 1 &&
      today.getDate() === day
    )
  }

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-zinc-800 bg-zinc-900/50 p-4", className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border border-zinc-800 bg-zinc-900/50 p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Palmtree className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-zinc-100">Holiday Mode</h3>
        {isTodayHoliday && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300 ml-auto">
            Active Today
          </span>
        )}
      </div>

      {/* Add Holiday Form */}
      <div className="space-y-2 mb-4 p-3 rounded-lg bg-zinc-800/50">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-100"
            />
          </div>
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
        </div>
        <Button
          onClick={handleAddHoliday}
          disabled={!newDate || isAdding}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </>
          )}
        </Button>
      </div>

      {/* Explanation */}
      <p className="text-xs text-zinc-500 mb-4">
        Holidays are excluded from staleness calculations. On holiday days,
        the stale wall is disabled and no daily target is required.
      </p>

      {/* Holiday List */}
      <div className="space-y-2">
        {holidays.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-sm">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No holidays scheduled
          </div>
        ) : (
          holidays.map((holiday) => (
            <div
              key={holiday.id}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg",
                isToday(holiday.date)
                  ? "bg-cyan-500/10 border border-cyan-500/30"
                  : "bg-zinc-800/50"
              )}
            >
              <div className="flex items-center gap-2">
                <Palmtree className={cn(
                  "h-4 w-4",
                  isToday(holiday.date) ? "text-cyan-400" : "text-zinc-500"
                )} />
                <div>
                  <span className={cn(
                    "text-sm font-medium",
                    isToday(holiday.date) ? "text-cyan-300" : "text-zinc-300"
                  )}>
                    {formatDate(holiday.date)}
                  </span>
                  {holiday.description && (
                    <span className="text-xs text-zinc-500 ml-2">
                      {holiday.description}
                    </span>
                  )}
                  {isToday(holiday.date) && (
                    <span className="text-xs text-cyan-400 ml-2">(Today)</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteHoliday(holiday.id)}
                disabled={deletingId === holiday.id}
                className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
              >
                {deletingId === holiday.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
