import { useEffect, useState } from 'react'
import type { Space } from '@shared/spaces'
import {
  SESSION_NOTE_MAX,
  formatHoursMinutes,
  formatSessionDate,
  localDateKey,
  parseSessionDraft,
  type HistorySession,
  type SessionDraft
} from '@shared/time'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { Button } from '@renderer/components/ui/Button'
import { IconTile } from '@renderer/components/ui/IconTile'
import { fieldClass } from '@renderer/components/ui/styles'
import { useSessionsChanged } from '@renderer/hooks/useSessionsChanged'
import { errorMessage } from '@renderer/lib/errors'

interface HistoryPageProps {
  spaces: Space[]
  spaceId: string | null
  onSpace: (spaceId: string | null) => void
}

export function HistoryPage({ spaces, spaceId, onSpace }: HistoryPageProps): React.JSX.Element {
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<HistorySession | null>(null)
  const [adding, setAdding] = useState(false)
  const active = spaces.filter((space) => space.status !== 'archived')

  async function reload(): Promise<void> {
    const next = await window.api.listSessionHistory(spaceId)
    setSessions(next)
  }

  useEffect(() => {
    let activeLoad = true
    void window.api
      .listSessionHistory(spaceId)
      .then((next) => {
        if (!activeLoad) return
        setSessions(next)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (activeLoad) setError(errorMessage(loadError))
      })
    return () => {
      activeLoad = false
    }
  }, [spaceId])

  useSessionsChanged(() => {
    void reload().catch((loadError: unknown) => {
      setError(errorMessage(loadError))
    })
  })

  const groups = groupByDay(sessions)
  const total = sessions.reduce((sum, session) => sum + session.durationSec, 0)

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-8 px-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-faint">Sessions</p>
          <h1 className="mt-2 text-[40px] font-semibold tracking-tight">History</h1>
          <p className="mt-3 text-sm text-muted">
            {sessions.length === 0
              ? 'Saved sessions show up here.'
              : `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} · ${formatHoursMinutes(total)}`}
          </p>
        </div>
        {spaceId ? (
          <Button
            variant="secondary"
            onClick={() => {
              setAdding((open) => !open)
              setEditingId(null)
            }}
          >
            Add entry
          </Button>
        ) : (
          <p className="text-sm text-muted">Choose a space to add an entry.</p>
        )}
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by space">
        <FilterChip
          label="All"
          selected={spaceId === null}
          onClick={() => {
            onSpace(null)
          }}
        />
        {active.map((space) => (
          <FilterChip
            key={space.id}
            label={space.name}
            selected={spaceId === space.id}
            onClick={() => {
              onSpace(space.id)
            }}
          />
        ))}
      </div>

      {adding && spaceId ? (
        <SessionEditor
          submitLabel="Add entry"
          onCancel={() => {
            setAdding(false)
          }}
          onSubmit={async (draft) => {
            await window.api.createSession(spaceId, draft)
            setAdding(false)
            await reload()
          }}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {groups.length === 0 && !adding ? (
        <p className="text-sm text-muted">
          {spaceId
            ? 'No saved sessions for this space. Add one, or start the timer.'
            : 'No saved sessions yet.'}
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="text-sm font-semibold">{group.label}</h2>
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {group.sessions.map((session) => (
                  <li key={session.id} className="py-3">
                    {editingId === session.id ? (
                      <SessionEditor
                        session={session}
                        submitLabel="Save"
                        onCancel={() => {
                          setEditingId(null)
                        }}
                        onSubmit={async (draft) => {
                          await window.api.updateSession(session.id, draft)
                          setEditingId(null)
                          await reload()
                        }}
                      />
                    ) : (
                      <div className="flex items-start gap-3">
                        <IconTile icon={session.spaceIcon} color={session.spaceColor} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-3">
                            <span className="text-sm font-medium">{session.spaceName}</span>
                            <span className="text-sm font-semibold tabular-nums">
                              {formatHoursMinutes(session.durationSec)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted">{session.note || 'No note'}</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted hover:text-text"
                          onClick={() => {
                            setAdding(false)
                            setEditingId(session.id)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted hover:text-danger"
                          onClick={() => {
                            setPendingDelete(session)
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this session?"
          body="The time comes out of the totals. This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => {
            setPendingDelete(null)
          }}
          onConfirm={() => {
            const target = pendingDelete
            setPendingDelete(null)
            void window.api
              .deleteSession(target.id)
              .then(() => reload())
              .catch((deleteError: unknown) => {
                setError(errorMessage(deleteError))
              })
          }}
        />
      ) : null}
    </main>
  )
}

function FilterChip({
  label,
  selected,
  onClick
}: {
  label: string
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`rounded-full px-3 py-1 text-sm transition duration-150 ${
        selected
          ? 'bg-text font-medium text-surface'
          : 'text-muted hover:bg-accent-soft hover:text-text'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function SessionEditor({
  session,
  submitLabel,
  onSubmit,
  onCancel
}: {
  session?: HistorySession
  submitLabel: string
  onSubmit: (draft: SessionDraft) => Promise<void>
  onCancel: () => void
}): React.JSX.Element {
  const [date, setDate] = useState(
    session ? localDateKey(new Date(session.startedAt)) : localDateKey()
  )
  const [hours, setHours] = useState(String(session ? Math.floor(session.durationSec / 3600) : 0))
  const [minutes, setMinutes] = useState(
    String(session ? Math.floor((session.durationSec % 3600) / 60) : 30)
  )
  const [note, setNote] = useState(session?.note ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(): Promise<void> {
    setSaving(true)
    setFormError(null)
    try {
      const durationSec = Math.round(Number(hours) * 3600 + Number(minutes) * 60)
      await onSubmit(parseSessionDraft({ date, durationSec, note }))
    } catch (submitError: unknown) {
      setFormError(errorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_5rem_5rem]">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Date</span>
          <input
            className={fieldClass}
            type="date"
            value={date}
            required
            onChange={(event) => {
              setDate(event.target.value)
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Hours</span>
          <input
            className={fieldClass}
            type="number"
            min="0"
            max="24"
            value={hours}
            onChange={(event) => {
              setHours(event.target.value)
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Minutes</span>
          <input
            className={fieldClass}
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(event) => {
              setMinutes(event.target.value)
            }}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted">Note</span>
        <textarea
          className={fieldClass}
          rows={2}
          maxLength={SESSION_NOTE_MAX}
          value={note}
          placeholder="What did this session cover?"
          onChange={(event) => {
            setNote(event.target.value)
          }}
        />
      </label>
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function groupByDay(
  sessions: HistorySession[]
): { date: string; label: string; sessions: HistorySession[] }[] {
  const groups: { date: string; label: string; sessions: HistorySession[] }[] = []
  for (const session of sessions) {
    const date = localDateKey(new Date(session.startedAt))
    const last = groups[groups.length - 1]
    if (last?.date === date) last.sessions.push(session)
    else groups.push({ date, label: formatSessionDate(session.startedAt), sessions: [session] })
  }
  return groups
}
