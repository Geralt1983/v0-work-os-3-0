"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Crosshair,
  LayoutGrid,
  List,
  ListTodo,
  MessageSquare,
  Palmtree,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Sparkles,
  Users,
  History,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

type TasksView = "board" | "list" | "focus"

const OPEN_EVENT = "workos:open-command-palette"

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable
}

function setSynapseCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return
  localStorage.setItem("synapse-sidebar-collapsed", String(collapsed))
  window.dispatchEvent(new Event("synapse-collapse-change"))
}

function dispatchNewTask() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("workos:new-task"))
}

function dispatchTasksView(view: TasksView) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("workos:set-tasks-view", { detail: { view } }))
}

function dispatchFocusQuickCapture() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("workos:focus-quick-capture"))
}

export function WorkOSCommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  const run = useCallback(
    (fn: () => void) => {
      close()
      // Let the dialog close animation start before routing/state changes.
      requestAnimationFrame(fn)
    },
    [close],
  )

  useEffect(() => {
    let chord: "g" | "v" | null = null
    let chordTimeoutId: number | null = null

    const clearChord = () => {
      chord = null
      if (chordTimeoutId !== null) {
        window.clearTimeout(chordTimeoutId)
        chordTimeoutId = null
      }
    }

    const setChord = (next: "g" | "v") => {
      chord = next
      if (chordTimeoutId !== null) window.clearTimeout(chordTimeoutId)
      chordTimeoutId = window.setTimeout(() => {
        chord = null
        chordTimeoutId = null
      }, 700)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
        clearChord()
        return
      }

      if (open) return
      if (isEditableTarget(e.target)) return

      const key = e.key.toLowerCase()

      if (key === "n") {
        e.preventDefault()
        if (pathname.startsWith("/tasks")) {
          dispatchNewTask()
        } else {
          router.push("/tasks?newTask=1")
        }
        clearChord()
        return
      }

      if (key === "q") {
        e.preventDefault()
        if (pathname.startsWith("/tasks")) {
          dispatchFocusQuickCapture()
        } else {
          router.push("/tasks?focus=1")
        }
        clearChord()
        return
      }

      if (key === "g") {
        e.preventDefault()
        setChord("g")
        return
      }

      if (key === "v" && pathname.startsWith("/tasks")) {
        e.preventDefault()
        setChord("v")
        return
      }

      if (chord === "g") {
        const hrefByKey: Record<string, string> = {
          t: "/tasks",
          c: "/clients",
          m: "/metrics",
          h: "/history",
          o: "/holidays",
        }
        const href = hrefByKey[key]
        if (href) {
          e.preventDefault()
          router.push(href)
        }
        clearChord()
        return
      }

      if (chord === "v") {
        const viewByKey: Record<string, TasksView> = {
          b: "board",
          l: "list",
          f: "focus",
        }
        const view = viewByKey[key]
        if (view) {
          e.preventDefault()
          dispatchTasksView(view)
        }
        clearChord()
        return
      }
    }

    const onOpenEvent = () => setOpen(true)

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener(OPEN_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener(OPEN_EVENT, onOpenEvent)
      clearChord()
    }
  }, [open, pathname, router])

  const isTasks = pathname.startsWith("/tasks")

  const navItems = useMemo(
    () => [
      { href: "/tasks", label: "Tasks", icon: ListTodo, shortcut: "G T" },
      { href: "/clients", label: "Clients", icon: Users, shortcut: "G C" },
      { href: "/metrics", label: "Metrics", icon: BarChart3, shortcut: "G M" },
      { href: "/history", label: "History", icon: History, shortcut: "G H" },
      { href: "/holidays", label: "Holidays", icon: Palmtree, shortcut: "G O" },
    ],
    [],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="WorkOS Command Palette"
      description="Search for a page or an action"
      className="panel-obsidian border-white/10 shadow-2xl shadow-black/60"
      showCloseButton={false}
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {navItems.map(({ href, label, icon: Icon, shortcut }) => (
            <CommandItem
              key={href}
              onSelect={() =>
                run(() => {
                  router.push(href)
                })
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
              <CommandShortcut>{shortcut}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              run(() => {
                if (isTasks) {
                  dispatchNewTask()
                } else {
                  router.push("/tasks?newTask=1")
                }
              })
            }
          >
            <Sparkles className="h-4 w-4 text-[color:var(--thanos-amethyst)]" aria-hidden="true" />
            <span>New task</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              run(() => {
                if (isTasks) {
                  dispatchFocusQuickCapture()
                } else {
                  router.push("/tasks?focus=1")
                }
              })
            }
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Focus quick capture</span>
            <CommandShortcut>Q</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Synapse">
          <CommandItem onSelect={() => run(() => setSynapseCollapsed(false))}>
            <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            <span>Open ThanosAI</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => setSynapseCollapsed(true))}>
            <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            <span>Collapse ThanosAI</span>
          </CommandItem>
        </CommandGroup>

        {isTasks && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks View">
              <CommandItem onSelect={() => run(() => dispatchTasksView("board"))}>
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                <span>Board</span>
                <CommandShortcut>V B</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => dispatchTasksView("list"))}>
                <List className="h-4 w-4" aria-hidden="true" />
                <span>List</span>
                <CommandShortcut>V L</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => dispatchTasksView("focus"))}>
                <Crosshair className="h-4 w-4" aria-hidden="true" />
                <span>Focus</span>
                <CommandShortcut>V F</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem onSelect={() => run(() => setOpen(false))}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span>Close</span>
            <CommandShortcut>Esc</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export const WORKOS_COMMAND_PALETTE_OPEN_EVENT = OPEN_EVENT
