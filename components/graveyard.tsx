"use client"

import { useState, memo, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skull, RotateCcw } from "lucide-react"
import { useTasks } from "@/hooks/use-tasks"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface ArchivedMove {
  id: number
  title: string
  clientName: string | null
  clientColor: string | null
  archiveReason: string
  daysInBacklog: number
  archivedAt: string
}

// Memoized archived task item
const ArchivedTaskItem = memo(function ArchivedTaskItem({
  task,
  onResurrect,
}: {
  task: ArchivedMove
  onResurrect: (id: number) => void
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: task.clientColor || undefined,
              color: task.clientColor || undefined,
            }}
          >
            {task.clientName || "Unknown"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {task.daysInBacklog}d in backlog - {task.archiveReason}
          </span>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => onResurrect(task.id)}>
        <RotateCcw className="h-4 w-4 mr-1" />
        Resurrect
      </Button>
    </div>
  )
})

export function Graveyard() {
  const { data, mutate } = useSWR<ArchivedMove[]>("/api/graveyard", fetcher)
  const { refresh: refreshTasks } = useTasks()
  const [open, setOpen] = useState(false)

  const handleResurrect = useCallback(async (id: number) => {
    await fetch(`/api/graveyard/${id}/resurrect`, { method: "POST" })
    mutate()
    refreshTasks()
  }, [mutate, refreshTasks])

  const archived = data || []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Skull className="h-4 w-4 mr-1" />
          Graveyard ({archived.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5" />
            Task Graveyard
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {archived.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No archived tasks. Tasks here were either auto-archived after 30 days or manually killed.
            </p>
          ) : (
            archived.map((task) => (
              <ArchivedTaskItem key={task.id} task={task} onResurrect={handleResurrect} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
