import { useEffect, useMemo, useState } from 'react'
import { describeDue } from '@shared/progress'
import type { Milestone } from '@shared/progress'
import type { Space } from '@shared/spaces'
import { goalInsight, paceWindow, secondsInWindow } from '@shared/insights'
import {
  elapsedSec,
  formatHoursMinutes,
  formatSessionDate,
  localDateKey,
  summarizeSessions,
  type Session
} from '@shared/time'
import { Button } from '@renderer/components/ui/Button'
import { useSessionsChanged } from '@renderer/hooks/useSessionsChanged'
import { useSettings } from '@renderer/hooks/useSettings'
import { errorMessage } from '@renderer/lib/errors'
import type { useTimer } from '@renderer/hooks/useTimer'

type TimerApi = ReturnType<typeof useTimer>

interface SpaceHomeProps {
  space: Space
  timer: TimerApi
  onOpenHistory: () => void
  onOpenMilestones: () => void
}

export function SpaceHome({
  space,
  timer,
  onOpenHistory,
  onOpenMilestones
}: SpaceHomeProps): React.JSX.Element {
  const { settings } = useSettings()
  const [sessions, setSessions] = useState<Session[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([window.api.listSessions(space.id), window.api.listMilestones(space.id)])
      .then(([nextSessions, nextMilestones]) => {
        if (!active) return
        setSessions(nextSessions)
        setMilestones(nextMilestones)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [space.id, timer.session?.id, timer.session?.running, timer.session?.durationSec])

  useSessionsChanged(() => {
    void window.api
      .listSessions(space.id)
      .then(setSessions)
      .catch((loadError: unknown) => {
        setError(errorMessage(loadError))
      })
  })

  const totals = useMemo(
    () => summarizeSessions(sessions, timer.now, settings.weekStartsOn),
    [sessions, timer.now, settings.weekStartsOn]
  )
  const recent = sessions.filter((session) => session.endedAt !== null).slice(0, 4)
  const next = nextMilestone(milestones)
  const done = milestones.filter((milestone) => milestone.done).length
  const daily = percentOf(totals.todaySec, space.dailyGoalMin)
  const weekly = percentOf(totals.weekSec, space.weeklyGoalMin)
  const pace = paceLine(space, sessions, timer.now)

  return (
    <div className="space-y-8 pt-8">
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {timer.error ? (
        <p className="text-sm text-danger" role="alert">
          {timer.error}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        <GoalStat
          label="Today"
          seconds={totals.todaySec}
          percent={daily}
          detail={space.dailyGoalMin ? `${space.dailyGoalMin}m goal` : 'No daily goal'}
        />
        <GoalStat
          label="This week"
          seconds={totals.weekSec}
          percent={weekly}
          detail={space.weeklyGoalMin ? `${space.weeklyGoalMin}m goal` : 'No weekly goal'}
        />
      </section>

      <section className="rounded-lg border border-border border-t-2 border-t-text bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Next milestone</h2>
          <button
            type="button"
            className="text-sm text-muted transition duration-150 hover:text-text"
            onClick={onOpenMilestones}
          >
            {done} of {milestones.length} finished
          </button>
        </div>
        {next ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-medium">{next.title}</p>
              <p className={`mt-1 text-sm ${dueClass(next)}`}>
                {describeDue(next.targetDate, false).label || 'No date'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                void window.api.setMilestoneDone(next.id, true).then(() => {
                  setMilestones((list) =>
                    list.map((item) =>
                      item.id === next.id
                        ? { ...item, done: true, doneAt: new Date().toISOString() }
                        : item
                    )
                  )
                })
              }}
            >
              Mark done
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {milestones.length === 0
              ? 'Add the steps that finish this space.'
              : 'Every milestone is done.'}
          </p>
        )}
        {milestones.length > 0 ? (
          <div className="meter mt-5" aria-hidden>
            <div
              className="meter-fill"
              style={{ width: `${Math.round((done / milestones.length) * 100)}%` }}
            />
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Recent sessions</h2>
          <button
            type="button"
            className="text-sm text-muted transition duration-150 hover:text-text"
            onClick={onOpenHistory}
          >
            All sessions
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No saved sessions yet. Start the timer above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {recent.map((session) => (
              <li key={session.id} className="flex items-baseline gap-4 py-3">
                <span className="w-28 shrink-0 text-sm text-muted">
                  {formatSessionDate(session.startedAt)}
                </span>
                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">
                  {formatHoursMinutes(elapsedSec(session, timer.now))}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                  {session.note || 'No note'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {pace ? <p className="mt-4 text-sm text-muted">{pace}</p> : null}
      </section>
    </div>
  )
}

function GoalStat({
  label,
  seconds,
  percent,
  detail
}: {
  label: string
  seconds: number
  percent: number | null
  detail: string
}): React.JSX.Element {
  return (
    <article className="rounded-lg border border-border border-t-2 border-t-text bg-surface p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
        {formatHoursMinutes(seconds)}
      </p>
      <div className="meter mt-4" aria-hidden>
        <div className="meter-fill" style={{ width: `${percent ?? 0}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {percent === null ? detail : `${percent}% of ${detail}`}
      </p>
    </article>
  )
}

function nextMilestone(milestones: Milestone[]): Milestone | null {
  const open = milestones.filter((milestone) => !milestone.done)
  const dated = open
    .filter((milestone) => milestone.targetDate)
    .sort((a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? ''))
  return dated[0] ?? open[0] ?? null
}

function dueClass(milestone: Milestone): string {
  const tone = describeDue(milestone.targetDate, false).tone
  if (tone === 'overdue') return 'font-medium text-danger'
  if (tone === 'today' || tone === 'soon') return 'font-medium text-text'
  return 'text-muted'
}

function percentOf(seconds: number, goalMin: number | null): number | null {
  if (goalMin === null || goalMin <= 0) return null
  return Math.min(100, Math.round((seconds / (goalMin * 60)) * 100))
}

function paceLine(space: Space, sessions: Session[], now: number): string | null {
  const window = paceWindow(space.createdAt, new Date(now))
  const byDate = new Map<string, number>()
  for (const session of sessions) {
    const date = localDateKey(new Date(session.startedAt))
    byDate.set(date, (byDate.get(date) ?? 0) + elapsedSec(session, now))
  }
  const logged = [...byDate.values()].reduce((sum, sec) => sum + sec, 0)
  return goalInsight(
    space,
    logged,
    secondsInWindow(
      [...byDate.entries()].map(([date, sec]) => ({ date, sec })),
      window.start,
      window.today
    ),
    window.days,
    new Date(now)
  )
}
