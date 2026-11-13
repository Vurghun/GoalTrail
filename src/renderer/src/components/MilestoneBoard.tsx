import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import {
  compareOpenMilestones,
  describeDue,
  parseMilestoneTitle,
  type Milestone
} from '@shared/progress'
import type { Space } from '@shared/spaces'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { Button } from '@renderer/components/ui/Button'
import { IconTile } from '@renderer/components/ui/IconTile'
import { fieldClass } from '@renderer/components/ui/styles'
import { errorMessage } from '@renderer/lib/errors'

type MilestoneFilter = 'open' | 'done' | 'all'

const FILTERS: { id: MilestoneFilter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' }
]

interface MilestoneBoardProps {
  spaces: Space[]
  variant: 'page' | 'section'
  onOpenSpace?: (spaceId: string) => void
}

export function MilestoneBoard({
  spaces,
  variant,
  onOpenSpace
}: MilestoneBoardProps): React.JSX.Element {
  const ids = spaces.map((space) => space.id).join('\n')
  const [bySpace, setBySpace] = useState<Record<string, Milestone[]>>({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<MilestoneFilter>('open')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [targetId, setTargetId] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [justDone, setJustDone] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Milestone | null>(null)
  const skipBlur = useRef(false)
  const addable = spaces.filter((space) => space.status !== 'archived')
  const resolvedTargetId = addable.some((space) => space.id === targetId)
    ? targetId
    : (addable[0]?.id ?? '')
  const loaded = spaces.length === 0 || ready

  useEffect(() => {
    if (ids.length === 0) return
    let active = true
    const current = spaces
    void Promise.all(
      current.map(async (space) => [space.id, await window.api.listMilestones(space.id)] as const)
    )
      .then((entries) => {
        if (!active) return
        setBySpace(Object.fromEntries(entries))
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
    // `ids` changes only when the set of spaces changes. Names update through props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  const milestones = spaces.flatMap((space) => bySpace[space.id] ?? [])
  const openCount = milestones.filter((milestone) => !milestone.done).length
  const doneCount = milestones.filter((milestone) => milestone.done).length
  const percent = milestones.length === 0 ? 0 : Math.round((doneCount / milestones.length) * 100)

  function patch(spaceId: string, update: (list: Milestone[]) => Milestone[]): void {
    setBySpace((current) => ({ ...current, [spaceId]: update(current[spaceId] ?? []) }))
  }

  async function reload(): Promise<void> {
    const entries = await Promise.all(
      spaces.map(async (space) => [space.id, await window.api.listMilestones(space.id)] as const)
    )
    setBySpace(Object.fromEntries(entries))
  }

  async function addMilestone(): Promise<void> {
    const spaceId = addable.length === 1 ? addable[0]?.id : resolvedTargetId
    if (!spaceId) return
    setAdding(true)
    setError(null)
    try {
      const clean = parseMilestoneTitle(title)
      const created = await window.api.createMilestone(spaceId, {
        title: clean,
        targetDate: due || null
      })
      patch(spaceId, (list) => [...list, created])
      setTitle('')
      setDue('')
      if (filter === 'done') setFilter('open')
    } catch (addError: unknown) {
      setError(errorMessage(addError))
    } finally {
      setAdding(false)
    }
  }

  async function toggle(spaceId: string, milestone: Milestone): Promise<void> {
    const done = !milestone.done
    patch(spaceId, (list) =>
      list.map((item) =>
        item.id === milestone.id
          ? { ...item, done, doneAt: done ? new Date().toISOString() : null }
          : item
      )
    )
    if (done) setJustDone(milestone.id)
    try {
      const saved = await window.api.setMilestoneDone(milestone.id, done)
      patch(spaceId, (list) => list.map((item) => (item.id === saved.id ? saved : item)))
    } catch (toggleError: unknown) {
      setError(errorMessage(toggleError))
      await reload().catch((loadError: unknown) => {
        setError(errorMessage(loadError))
      })
    }
  }

  async function move(spaceId: string, id: string, direction: -1 | 1): Promise<void> {
    const list = bySpace[spaceId] ?? []
    const index = list.findIndex((milestone) => milestone.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= list.length) return
    const ordered = list.slice()
    const [moved] = ordered.splice(index, 1)
    if (!moved) return
    ordered.splice(target, 0, moved)
    patch(spaceId, () => ordered)
    try {
      const saved = await window.api.reorderMilestones(
        spaceId,
        ordered.map((milestone) => milestone.id)
      )
      patch(spaceId, () => saved)
    } catch (moveError: unknown) {
      setError(errorMessage(moveError))
      await reload().catch((loadError: unknown) => {
        setError(errorMessage(loadError))
      })
    }
  }

  async function setDueDate(
    spaceId: string,
    milestone: Milestone,
    targetDate: string | null
  ): Promise<void> {
    if (targetDate === milestone.targetDate) return
    try {
      const saved = await window.api.updateMilestone(milestone.id, {
        title: milestone.title,
        targetDate
      })
      patch(spaceId, (list) => list.map((item) => (item.id === saved.id ? saved : item)))
    } catch (dateError: unknown) {
      setError(errorMessage(dateError))
    }
  }

  async function commitTitle(spaceId: string, milestone: Milestone): Promise<void> {
    if (skipBlur.current) {
      skipBlur.current = false
      return
    }
    setEditingId(null)
    if (draft.trim() === milestone.title) return
    try {
      const clean = parseMilestoneTitle(draft)
      const saved = await window.api.updateMilestone(milestone.id, {
        title: clean,
        targetDate: milestone.targetDate
      })
      patch(spaceId, (list) => list.map((item) => (item.id === saved.id ? saved : item)))
    } catch (renameError: unknown) {
      setError(errorMessage(renameError))
    }
  }

  const activeSpaces = spaces.filter((space) => space.status !== 'archived')
  const archivedSpaces = spaces.filter((space) => space.status === 'archived')

  return (
    <div
      className={
        variant === 'page' ? 'mx-auto w-full max-w-[720px] px-8 py-12' : 'max-w-[720px] pt-8'
      }
    >
      {variant === 'page' ? (
        <header>
          <h1 className="text-[40px] font-semibold tracking-tight">Milestones</h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
            The steps that mean a space is finished.
          </p>
        </header>
      ) : null}

      <div
        className={`flex flex-wrap items-end justify-between gap-4 ${variant === 'page' ? 'mt-10' : ''}`}
      >
        {variant === 'page' ? (
          <div className="flex gap-10">
            <Count value={openCount} label="Open" />
            <Count value={doneCount} label="Done" />
          </div>
        ) : (
          <p className="text-sm text-muted tabular-nums">
            {openCount} open · {doneCount} done
          </p>
        )}
        <FilterControl filter={filter} onFilter={setFilter} />
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {milestones.length === 0 ? 'No milestones yet' : `${percent}% finished`}
          </span>
          <span className="text-muted tabular-nums">
            {doneCount} of {milestones.length}
          </span>
        </div>
        <div className="meter" aria-hidden>
          <div className="meter-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {addable.length === 0 ? (
        variant === 'page' ? (
          <p className="mt-8 text-sm text-muted">
            {spaces.length === 0
              ? 'Create a space, then add the steps that finish it.'
              : 'Restore a space to add milestones.'}
          </p>
        ) : null
      ) : (
        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void addMilestone()
          }}
        >
          {addable.length > 1 ? (
            <select
              className={`${fieldClass} w-auto max-w-[14rem]`}
              aria-label="Space"
              value={resolvedTargetId}
              onChange={(event) => {
                setTargetId(event.target.value)
              }}
            >
              {addable.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          ) : null}
          <input
            className={`${fieldClass} min-w-[16rem] flex-1`}
            value={title}
            placeholder="Name the milestone"
            aria-label="New milestone"
            autoComplete="off"
            onChange={(event) => {
              setTitle(event.target.value)
            }}
          />
          <input
            className={`${fieldClass} w-auto`}
            type="date"
            value={due}
            aria-label="Target date"
            onChange={(event) => {
              setDue(event.target.value)
            }}
          />
          <Button type="submit" disabled={adding || title.trim().length === 0}>
            Add
          </Button>
        </form>
      )}

      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!loaded ? (
        <div className="mt-8 space-y-3" aria-hidden>
          <div className="shimmer h-12 rounded-md" />
          <div className="shimmer h-12 rounded-md" />
          <div className="shimmer h-12 rounded-md" />
        </div>
      ) : (
        <div className="mt-4">
          <SpaceGroups
            spaces={activeSpaces}
            bySpace={bySpace}
            filter={filter}
            showSpace={variant === 'page'}
            onOpenSpace={onOpenSpace}
            editingId={editingId}
            draft={draft}
            justDone={justDone}
            onDraft={setDraft}
            onEdit={(milestone) => {
              skipBlur.current = false
              setEditingId(milestone.id)
              setDraft(milestone.title)
            }}
            onCommit={(spaceId, milestone) => {
              void commitTitle(spaceId, milestone)
            }}
            onCancelEdit={() => {
              skipBlur.current = true
              setEditingId(null)
            }}
            onToggle={(spaceId, milestone) => {
              void toggle(spaceId, milestone)
            }}
            onMove={(spaceId, id, direction) => {
              void move(spaceId, id, direction)
            }}
            onDelete={setPendingDelete}
            onSetDue={(spaceId, milestone, targetDate) => {
              void setDueDate(spaceId, milestone, targetDate)
            }}
          />
          {archivedSpaces.some(
            (space) => visibleMilestones(bySpace[space.id] ?? [], filter).length > 0
          ) ? (
            <div className="mt-10">
              <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Archived</h2>
              <SpaceGroups
                spaces={archivedSpaces}
                bySpace={bySpace}
                filter={filter}
                showSpace={variant === 'page'}
                onOpenSpace={onOpenSpace}
                editingId={editingId}
                draft={draft}
                justDone={justDone}
                onDraft={setDraft}
                onEdit={(milestone) => {
                  skipBlur.current = false
                  setEditingId(milestone.id)
                  setDraft(milestone.title)
                }}
                onCommit={(spaceId, milestone) => {
                  void commitTitle(spaceId, milestone)
                }}
                onCancelEdit={() => {
                  skipBlur.current = true
                  setEditingId(null)
                }}
                onToggle={(spaceId, milestone) => {
                  void toggle(spaceId, milestone)
                }}
                onMove={(spaceId, id, direction) => {
                  void move(spaceId, id, direction)
                }}
                onDelete={setPendingDelete}
                onSetDue={(spaceId, milestone, targetDate) => {
                  void setDueDate(spaceId, milestone, targetDate)
                }}
              />
            </div>
          ) : null}
          {loaded && visibleCount(spaces, bySpace, filter) === 0 ? (
            <p className="py-10 text-sm text-muted">
              {milestones.length === 0
                ? 'Nothing here yet. Add the first step above.'
                : filter === 'open'
                  ? 'Every milestone is done.'
                  : 'Nothing in this view.'}
            </p>
          ) : null}
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete ${pendingDelete.title}?`}
          body="This removes the milestone from the checklist."
          confirmLabel="Delete"
          onCancel={() => {
            setPendingDelete(null)
          }}
          onConfirm={() => {
            const target = pendingDelete
            setPendingDelete(null)
            patch(target.spaceId, (list) => list.filter((item) => item.id !== target.id))
            void window.api.deleteMilestone(target.id).catch((deleteError: unknown) => {
              setError(errorMessage(deleteError))
              void reload().catch((loadError: unknown) => {
                setError(errorMessage(loadError))
              })
            })
          }}
        />
      ) : null}
    </div>
  )
}

function Count({ value, label }: { value: number; label: string }): React.JSX.Element {
  return (
    <div>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}

function FilterControl({
  filter,
  onFilter
}: {
  filter: MilestoneFilter
  onFilter: (filter: MilestoneFilter) => void
}): React.JSX.Element {
  return (
    <div
      className="flex rounded-md border border-border p-0.5"
      role="tablist"
      aria-label="Milestone filter"
    >
      {FILTERS.map((option) => {
        const selected = filter === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`rounded-sm px-3 py-1 text-xs font-medium transition duration-150 ease-out ${
              selected ? 'bg-text text-surface' : 'text-muted hover:text-text'
            }`}
            onClick={() => {
              onFilter(option.id)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function visibleCount(
  spaces: Space[],
  bySpace: Record<string, Milestone[]>,
  filter: MilestoneFilter
): number {
  return spaces.reduce(
    (sum, space) => sum + visibleMilestones(bySpace[space.id] ?? [], filter).length,
    0
  )
}

function visibleMilestones(milestones: Milestone[], filter: MilestoneFilter): Milestone[] {
  if (filter === 'open') {
    return milestones.filter((milestone) => !milestone.done).sort(compareOpenMilestones)
  }
  if (filter === 'done') return milestones.filter((milestone) => milestone.done)
  return milestones
}

interface GroupHandlers {
  showSpace: boolean
  filter: MilestoneFilter
  bySpace: Record<string, Milestone[]>
  editingId: string | null
  draft: string
  justDone: string | null
  onOpenSpace?: (spaceId: string) => void
  onDraft: (value: string) => void
  onEdit: (milestone: Milestone) => void
  onCommit: (spaceId: string, milestone: Milestone) => void
  onCancelEdit: () => void
  onToggle: (spaceId: string, milestone: Milestone) => void
  onMove: (spaceId: string, id: string, direction: -1 | 1) => void
  onDelete: (milestone: Milestone) => void
  onSetDue: (spaceId: string, milestone: Milestone, targetDate: string | null) => void
}

function SpaceGroups({
  spaces,
  ...handlers
}: GroupHandlers & { spaces: Space[] }): React.JSX.Element {
  return (
    <>
      {spaces.map((space) => {
        const milestones = handlers.bySpace[space.id] ?? []
        const visible = visibleMilestones(milestones, handlers.filter)
        if (visible.length === 0) return null
        return (
          <section key={space.id} className={handlers.showSpace ? 'mt-8' : ''}>
            {handlers.showSpace ? (
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium transition duration-150 hover:opacity-70"
                onClick={() => {
                  handlers.onOpenSpace?.(space.id)
                }}
              >
                <IconTile icon={space.icon} color={space.color} size="sm" />
                {space.name}
              </button>
            ) : null}
            <ul
              className={handlers.showSpace ? 'mt-2' : ''}
              aria-label={handlers.showSpace ? undefined : 'Milestones'}
            >
              <AnimatePresence initial={false}>
                {visible.map((milestone) => {
                  const index = milestones.findIndex((item) => item.id === milestone.id)
                  return (
                    <motion.li
                      key={milestone.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="border-b border-border"
                    >
                      <div className="group flex items-center gap-3 py-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={milestone.done}
                          aria-label={
                            milestone.done
                              ? `Mark ${milestone.title} open`
                              : `Mark ${milestone.title} done`
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center motion-safe:active:scale-95"
                          onClick={() => {
                            handlers.onToggle(space.id, milestone)
                          }}
                        >
                          <span
                            className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border transition duration-150 ${
                              milestone.done
                                ? 'border-text bg-text text-surface'
                                : 'border-line bg-surface'
                            }`}
                          >
                            <Check
                              size={11}
                              strokeWidth={2.5}
                              className={
                                milestone.done
                                  ? handlers.justDone === milestone.id
                                    ? 'check-in'
                                    : ''
                                  : 'opacity-0'
                              }
                            />
                          </span>
                        </button>
                        {handlers.editingId === milestone.id ? (
                          <input
                            className={fieldClass}
                            value={handlers.draft}
                            aria-label="Milestone title"
                            autoFocus
                            onChange={(event) => {
                              handlers.onDraft(event.target.value)
                            }}
                            onBlur={() => {
                              handlers.onCommit(space.id, milestone)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                event.currentTarget.blur()
                              } else if (event.key === 'Escape') {
                                event.preventDefault()
                                handlers.onCancelEdit()
                                event.currentTarget.blur()
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className={`min-w-0 flex-1 truncate text-left text-[15px] font-medium transition-colors duration-150 ${
                              milestone.done ? 'text-muted line-through decoration-line' : ''
                            }`}
                            onClick={() => {
                              handlers.onEdit(milestone)
                            }}
                          >
                            {milestone.title}
                          </button>
                        )}
                        <DueControl
                          milestone={milestone}
                          onChange={(targetDate) => {
                            handlers.onSetDue(space.id, milestone, targetDate)
                          }}
                        />
                        {handlers.filter === 'all' ? (
                          <span className="flex shrink-0 opacity-40 transition duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                            <IconButton
                              label={`Move ${milestone.title} up`}
                              disabled={index <= 0}
                              onClick={() => {
                                handlers.onMove(space.id, milestone.id, -1)
                              }}
                            >
                              <ChevronUp size={14} />
                            </IconButton>
                            <IconButton
                              label={`Move ${milestone.title} down`}
                              disabled={index === milestones.length - 1}
                              onClick={() => {
                                handlers.onMove(space.id, milestone.id, 1)
                              }}
                            >
                              <ChevronDown size={14} />
                            </IconButton>
                          </span>
                        ) : null}
                        <span className="opacity-40 transition duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                          <IconButton
                            label={`Delete ${milestone.title}`}
                            danger
                            onClick={() => {
                              handlers.onDelete(milestone)
                            }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </span>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </section>
        )
      })}
    </>
  )
}

function DueControl({
  milestone,
  onChange
}: {
  milestone: Milestone
  onChange: (targetDate: string | null) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const due = describeDue(milestone.targetDate, milestone.done)
  const finished =
    milestone.done && milestone.doneAt
      ? `Finished ${new Date(milestone.doneAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : null
  const label = milestone.done ? (finished ?? 'Done') : due.label || 'Add date'
  const tone =
    due.tone === 'overdue'
      ? 'text-danger'
      : due.tone === 'today' || due.tone === 'soon'
        ? 'font-medium text-text'
        : 'text-muted'
  if (open) {
    return (
      <input
        type="date"
        autoFocus
        aria-label={`Target date for ${milestone.title}`}
        className={`${fieldClass} w-auto py-1 text-xs`}
        value={milestone.targetDate ?? ''}
        onChange={(event) => {
          onChange(event.target.value || null)
        }}
        onBlur={() => {
          setOpen(false)
        }}
      />
    )
  }
  return (
    <button
      type="button"
      className={`shrink-0 text-xs tabular-nums ${milestone.done ? 'text-faint' : tone} ${
        due.label || milestone.done
          ? ''
          : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
      }`}
      onClick={() => {
        setOpen(true)
      }}
    >
      {label}
    </button>
  )
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition duration-150 disabled:opacity-30 ${
        danger ? 'text-faint hover:text-danger' : 'text-faint hover:text-text'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
