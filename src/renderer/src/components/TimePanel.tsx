import { useEffect, useMemo, useState } from 'react'
import type { Space } from '@shared/spaces'
import { goalInsight, paceWindow, secondsInWindow } from '@shared/insights'
import {
  SESSION_NOTE_MAX,
  elapsedSec,
  formatHoursMinutes,
  formatSessionDate,
  localDateKey,
  parseSessionDraft,
  summarizeSessions,
  type Session,
  type SessionDraft
} from '@shared/time'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { fieldClass } from '@renderer/components/ui/styles'
import { useSessionsChanged } from '@renderer/hooks/useSessionsChanged'
import { useSettings } from '@renderer/hooks/useSettings'
import { errorMessage } from '@renderer/lib/errors'
import type { useTimer } from '@renderer/hooks/useTimer'

type TimerApi = ReturnType<typeof useTimer>

interface TimePanelProps {
  space: Space
  timer: TimerApi
  children?: React.ReactNode
}

const quietButton =
  'rounded-md border border-border px-3 py-1.5 text-sm text-text transition hover:bg-accent-soft'

export function TimePanel({ space, timer, children }: TimePanelProps): React.JSX.Element {
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null)
  const { settings } = useSettings()
  const totals = useMemo(
    () => summarizeSessions(sessions, timer.now, settings.weekStartsOn),
    [sessions, timer.now, settings.weekStartsOn]
  )
  const history = sessions.filter((session) => session.endedAt !== null)

  async function reload(): Promise<void> {
    const next = await window.api.listSessions(space.id)
    setSessions(next)
  }

  useEffect(() => {
    let active = true
    void window.api
      .listSessions(space.id)
      .then((next) => {
        if (active) setSessions(next)
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [space.id, timer.session?.id, timer.session?.running, timer.session?.durationSec])

  useSessionsChanged(() => {
    void reload()
  })

  async function saveDraft(draft: SessionDraft, sessionId?: string): Promise<void> {
    if (sessionId) await window.api.updateSession(sessionId, draft)
    else await window.api.createSession(space.id, draft)
    await reload()
    setEditingId(null)
    setError(null)
  }

  const hours = totals.totalSec / 3600
  const target = space.targetHours
  const ratio = target && target > 0 ? Math.min(1, hours / target) : null
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
          <h2 className="text-base font-semibold tracking-tight">Time</h2>
          {timer.error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {timer.error}
            </p>
          ) : null}
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Total label="Today" value={totals.todaySec} />
            <Total label="This week" value={totals.weekSec} />
            <Total label="This month" value={totals.monthSec} />
            <Total label="All time" value={totals.totalSec} />
          </dl>
        </div>
        {children}

        <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
          <h3 className="text-sm font-semibold">Add time</h3>
          <SessionForm
            key={`new-${space.id}`}
            submitLabel="Add entry"
            onSubmit={async (draft) => {
              await saveDraft(draft)
            }}
          />
          {error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          {history.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No saved sessions yet. Start the timer or add one.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {history.map((session) => (
                <li key={session.id} className="py-3">
                  {editingId === session.id ? (
                    <SessionForm
                      initial={session}
                      submitLabel="Save entry"
                      onCancel={() => {
                        setEditingId(null)
                      }}
                      onSubmit={async (draft) => {
                        await saveDraft(draft, session.id)
                      }}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {formatSessionDate(session.startedAt)}
                          <span className="mx-2 text-faint">·</span>
                          {formatHoursMinutes(session.durationSec)}
                        </p>
                        {session.note ? (
                          <p className="mt-1 text-sm text-muted">{session.note}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="text-sm text-muted hover:text-text"
                          onClick={() => {
                            setEditingId(session.id)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-sm text-danger"
                          onClick={() => {
                            setPendingDelete(session)
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <aside className="rounded-lg border border-border bg-surface p-5 shadow-card xl:sticky xl:top-4">
        <ProgressRing
          ratio={ratio}
          label={
            target
              ? `${formatHoursMinutes(totals.totalSec)} / ${target}h`
              : formatHoursMinutes(totals.totalSec)
          }
        />
        <p className="mt-4 text-center text-sm text-muted">
          {target ? 'Hours toward the target' : 'All tracked time in this space'}
        </p>
        <PaceNote space={space} sessions={sessions} now={timer.now} loggedSec={totals.totalSec} />
        {space.targetDate ? (
          <p className="mt-2 text-center text-xs text-faint">Target date {space.targetDate}</p>
        ) : null}
      </aside>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this time entry?"
          body={`${formatSessionDate(pendingDelete.startedAt)}, ${formatHoursMinutes(pendingDelete.durationSec)}. This cannot be undone.`}
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
    </div>
  )
}

function PaceNote({
  space,
  sessions,
  now,
  loggedSec
}: {
  space: Space
  sessions: Session[]
  now: number
  loggedSec: number
}): React.JSX.Element | null {
  const window = paceWindow(space.createdAt, new Date(now))
  const byDate = new Map<string, number>()
  for (const session of sessions) {
    const date = localDateKey(new Date(session.startedAt))
    byDate.set(date, (byDate.get(date) ?? 0) + elapsedSec(session, now))
  }
  const line = goalInsight(
    space,
    loggedSec,
    secondsInWindow(
      [...byDate.entries()].map(([date, sec]) => ({ date, sec })),
      window.start,
      window.today
    ),
    window.days,
    new Date(now)
  )
  if (!line) return null
  return <p className="mt-3 text-center text-sm text-muted">{line}</p>
}

function ProgressRing({
  ratio,
  label
}: {
  ratio: number | null
  label: string
}): React.JSX.Element {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const shown = ratio ?? 0
  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--text)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circumference * shown} ${circumference}`}
          className="transition-[stroke-dasharray] duration-300 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <span className="text-lg font-semibold tabular-nums">
          {ratio === null ? '—' : `${Math.round(ratio * 100)}%`}
        </span>
        <span className="text-xs text-muted">{label}</span>
      </div>
    </div>
  )
}

function Total({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-md bg-bg px-3 py-2">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{formatHoursMinutes(value)}</dd>
    </div>
  )
}

interface SessionFormProps {
  initial?: Session
  submitLabel: string
  onSubmit: (draft: SessionDraft) => Promise<void>
  onCancel?: () => void
}

function SessionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel
}: SessionFormProps): React.JSX.Element {
  const initialHours = initial ? Math.floor(initial.durationSec / 3600) : 0
  const initialMinutes = initial ? Math.floor((initial.durationSec % 3600) / 60) : 30
  const [date, setDate] = useState(
    initial ? localDateKey(new Date(initial.startedAt)) : localDateKey()
  )
  const [hours, setHours] = useState(String(initialHours))
  const [minutes, setMinutes] = useState(String(initialMinutes))
  const [note, setNote] = useState(initial?.note ?? '')
  const [durationTouched, setDurationTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(): Promise<void> {
    setSaving(true)
    setFormError(null)
    try {
      const durationSec = durationTouched
        ? readDuration(hours, minutes)
        : (initial?.durationSec ?? readDuration(hours, minutes))
      const draft = parseSessionDraft({ date, durationSec, note })
      await onSubmit(draft)
      if (!initial) {
        setHours('0')
        setMinutes('30')
        setNote('')
        setDurationTouched(false)
      }
    } catch (submitError: unknown) {
      setFormError(errorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_5rem_5rem]">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Date</span>
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
          <span className="mb-1 block font-medium">Hours</span>
          <input
            className={fieldClass}
            type="number"
            min="0"
            max="24"
            step="1"
            value={hours}
            onChange={(event) => {
              setDurationTouched(true)
              setHours(event.target.value)
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Minutes</span>
          <input
            className={fieldClass}
            type="number"
            min="0"
            max="59"
            step="1"
            value={minutes}
            onChange={(event) => {
              setDurationTouched(true)
              setMinutes(event.target.value)
            }}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Note</span>
        <input
          className={fieldClass}
          value={note}
          maxLength={SESSION_NOTE_MAX}
          placeholder="Optional"
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
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className={quietButton} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}

function readDuration(hoursText: string, minutesText: string): number {
  const hours = hoursText.trim() === '' ? 0 : Number(hoursText)
  const minutes = minutesText.trim() === '' ? 0 : Number(minutesText)
  if (!Number.isInteger(hours) || hours < 0 || hours > 24) {
    throw new Error('Hours must be a whole number from 0 to 24.')
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    throw new Error('Minutes must be a whole number from 0 to 59.')
  }
  const total = hours * 3600 + minutes * 60
  if (total <= 0) throw new Error('Enter a duration.')
  if (total > 24 * 60 * 60) throw new Error('A manual entry cannot be longer than 24 hours.')
  return total
}
