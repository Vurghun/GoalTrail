import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { NoteSearchHit } from '@shared/notes'
import type { Space } from '@shared/spaces'

interface Command {
  id: string
  group: string
  label: string
  hint?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  spaces: Space[]
  onClose: () => void
  onOpenSpace: (spaceId: string) => void
  onOpenNote: (spaceId: string, noteId: string) => void
  onStartTimer: (spaceId: string) => void
  onSearchAll: (text: string) => void
  onNewSpace: () => void
  onDashboard: () => void
  onMilestones: () => void
  onNotes: () => void
  onReview: () => void
  onHistory: () => void
  onSettings: () => void
  onCycleTheme: () => void
  onFocus: () => void
  onShortcuts: () => void
}

const RECENT_KEY = 'goaltrail.recent'

export function CommandPalette(props: CommandPaletteProps): React.JSX.Element | null {
  const [text, setText] = useState('')
  const [notes, setNotes] = useState<NoteSearchHit[]>([])
  const [active, setActive] = useState(0)
  const recent = props.open ? readRecent() : []

  useEffect(() => {
    if (!props.open) return
    const query = text.trim()
    if (query.length === 0) return
    let alive = true
    const timer = window.setTimeout(() => {
      void window.api
        .searchNotes({ text: query, spaceId: null, tag: null })
        .then((hits) => {
          if (alive) setNotes(hits.slice(0, 6))
        })
        .catch(() => {
          if (alive) setNotes([])
        })
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [props.open, text])

  const commands = buildCommands(props, text, notes, recent)

  if (!props.open) return null

  function run(command: Command): void {
    remember(command.id)
    command.run()
  }

  const groups = groupCommands(commands)

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/40 px-4 pt-[12vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="rise w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface shadow-card"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="text-faint" />
          <input
            autoFocus
            value={text}
            aria-label="Search commands, spaces, and notes"
            placeholder="Search or jump…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-faint"
            onChange={(event) => {
              setText(event.target.value)
              setNotes([])
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((index) => Math.min(commands.length - 1, index + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((index) => Math.max(0, index - 1))
              } else if (event.key === 'Enter') {
                const command = commands[active]
                if (command) run(command)
              } else if (event.key === 'Escape') {
                props.onClose()
              }
            }}
          />
          <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-faint">
            Esc
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {commands.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">Nothing matches that.</p>
          ) : (
            groups.map((group) => (
              <section key={group.name}>
                <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-faint uppercase">
                  {group.name}
                </p>
                {group.items.map((command) => {
                  const index = commands.indexOf(command)
                  return (
                    <button
                      key={command.id}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                        index === active ? 'bg-accent-soft' : 'hover:bg-accent-soft'
                      }`}
                      onMouseEnter={() => {
                        setActive(index)
                      }}
                      onClick={() => {
                        run(command)
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{command.label}</span>
                      {command.hint ? (
                        <span className="text-[11px] text-faint">{command.hint}</span>
                      ) : null}
                    </button>
                  )
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function buildCommands(
  props: CommandPaletteProps,
  text: string,
  notes: NoteSearchHit[],
  recent: string[]
): Command[] {
  const query = text.trim().toLowerCase()
  const actions: Command[] = [
    { id: 'new-space', group: 'Actions', label: 'New space', hint: '', run: props.onNewSpace },
    {
      id: 'dashboard',
      group: 'Actions',
      label: 'Go to dashboard',
      hint: 'G D',
      run: props.onDashboard
    },
    {
      id: 'review',
      group: 'Actions',
      label: 'Go to weekly review',
      hint: 'G R',
      run: props.onReview
    },
    {
      id: 'milestones',
      group: 'Actions',
      label: 'Go to milestones',
      hint: 'G M',
      run: props.onMilestones
    },
    {
      id: 'notes',
      group: 'Actions',
      label: 'Go to notes',
      hint: 'G N',
      run: props.onNotes
    },
    {
      id: 'history',
      group: 'Actions',
      label: 'Go to session history',
      hint: 'G H',
      run: props.onHistory
    },
    { id: 'settings', group: 'Actions', label: 'Go to settings', run: props.onSettings },
    { id: 'theme', group: 'Actions', label: 'Switch theme', run: props.onCycleTheme },
    { id: 'focus', group: 'Actions', label: 'Open focus mode', run: props.onFocus },
    {
      id: 'shortcuts',
      group: 'Actions',
      label: 'Keyboard shortcuts',
      hint: '?',
      run: props.onShortcuts
    }
  ]
  const spaces: Command[] = props.spaces
    .filter((space) => space.status !== 'archived')
    .map((space) => ({
      id: `space:${space.id}`,
      group: 'Spaces',
      label: space.name,
      hint: 'Open',
      run: () => {
        props.onOpenSpace(space.id)
      }
    }))
  const starts: Command[] = props.spaces
    .filter((space) => space.status !== 'archived')
    .map((space) => ({
      id: `start:${space.id}`,
      group: 'Timer',
      label: `Start session in ${space.name}`,
      run: () => {
        props.onStartTimer(space.id)
      }
    }))
  const noteCommands: Command[] = notes.map((note) => ({
    id: `note:${note.id}`,
    group: 'Notes',
    label: note.title || 'Untitled note',
    hint: note.spaceName,
    run: () => {
      props.onOpenNote(note.spaceId, note.id)
    }
  }))
  const search: Command[] =
    query.length > 0
      ? [
          {
            id: 'search-all',
            group: 'Notes',
            label: `Search all notes for “${text.trim()}”`,
            run: () => {
              props.onSearchAll(text.trim())
            }
          }
        ]
      : []
  const all = [...actions, ...starts, ...spaces, ...noteCommands, ...search]
  const filtered =
    query.length === 0 ? all.slice(0, 8) : all.filter((command) => fuzzy(command.label, query))
  if (query.length > 0 || recent.length === 0) return filtered
  const recentCommands = recent
    .map((id) => all.find((command) => command.id === id))
    .filter((command): command is Command => Boolean(command))
    .map((command) => ({ ...command, id: `recent:${command.id}`, group: 'Recent' }))
  return [...recentCommands, ...filtered.filter((command) => !recent.includes(command.id))].slice(
    0,
    10
  )
}

function groupCommands(commands: Command[]): { name: string; items: Command[] }[] {
  const order: string[] = []
  const map = new Map<string, Command[]>()
  for (const command of commands) {
    const list = map.get(command.group)
    if (list) list.push(command)
    else {
      map.set(command.group, [command])
      order.push(command.group)
    }
  }
  return order.map((name) => ({ name, items: map.get(name) ?? [] }))
}

function fuzzy(label: string, query: string): boolean {
  const haystack = label.toLowerCase()
  if (haystack.includes(query)) return true
  let index = 0
  for (const char of haystack) {
    if (char === query[index]) index += 1
    if (index === query.length) return true
  }
  return false
}

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string').slice(0, 5)
      : []
  } catch {
    return []
  }
}

function remember(id: string): void {
  const clean = id.replace(/^recent:/, '')
  const next = [clean, ...readRecent().filter((item) => item !== clean)].slice(0, 5)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}
