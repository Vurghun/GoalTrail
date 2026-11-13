import { useEffect, useState } from 'react'
import { CalendarDays, Clock, Flame, Play, Square, Timer, TrendingUp } from 'lucide-react'
import {
  assembleDashboard,
  isBestDaySoFar,
  type DashboardRange,
  type DashboardSource
} from '@shared/dashboard'
import { goalInsight, paceWindow, secondsInWindow } from '@shared/insights'
import type { Space } from '@shared/spaces'
import { WEEKDAY_LABELS } from '@shared/settings'
import { formatHoursMinutes, formatSessionDate, localDateKey, startOfWeek } from '@shared/time'
import { Celebration } from '@renderer/components/Celebration'
import { DashboardCharts } from '@renderer/components/DashboardCharts'
import { Heatmap } from '@renderer/components/Heatmap'
import { Button } from '@renderer/components/ui/Button'
import { Duration } from '@renderer/components/ui/Duration'
import { IconTile } from '@renderer/components/ui/IconTile'
import { useSessionsChanged } from '@renderer/hooks/useSessionsChanged'
import { useSettings } from '@renderer/hooks/useSettings'
import { errorMessage } from '@renderer/lib/errors'
import type { useTimer } from '@renderer/hooks/useTimer'

type TimerApi = ReturnType<typeof useTimer>

interface DashboardPageProps {
  hasSpaces: boolean
  spaces: Space[]
  timer: TimerApi
  onOpenSpace: (spaceId: string) => void
  onOpenNote: (spaceId: string, noteId: string) => void
  onCreateSpace: () => void
}

export function DashboardPage({
  hasSpaces,
  spaces,
  timer,
  onOpenSpace,
  onOpenNote,
  onCreateSpace
}: DashboardPageProps): React.JSX.Element {
  const { settings } = useSettings()
  const [source, setSource] = useState<DashboardSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<DashboardRange>(7)
  const [picking, setPicking] = useState(false)
  const [goneCheer, setGoneCheer] = useState<string | null>(null)

  useEffect(() => {
    if (!hasSpaces) return
    let active = true
    const load = (): void => {
      void window.api
        .getDashboard()
        .then((next) => {
          if (!active) return
          setSource(next)
          setError(null)
        })
        .catch((loadError: unknown) => {
          if (active) setError(errorMessage(loadError))
        })
    }
    load()
    return () => {
      active = false
    }
  }, [hasSpaces, timer.session?.id, timer.session?.running, timer.session?.durationSec])

  useSessionsChanged(() => {
    if (!hasSpaces) return
    void window.api.getDashboard().then(setSource).catch((loadError: unknown) => {
      setError(errorMessage(loadError))
    })
  })

  const now = new Date(timer.now)
  const view = source ? assembleDashboard(source, timer.now, range, settings.weekStartsOn) : null
  const byId = new Map(spaces.map((space) => [space.id, space]))
  const stats = source && view ? periodStats(source, view.todaySec, view.weekSec, settings.weekStartsOn, timer.now) : null
  const startable = spaces.filter((space) => space.status !== 'archived')

  const cheer = celebration(view, source, spaces, timer.now)
  const visibleCheer =
    cheer && cheer.key !== goneCheer && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? cheer
      : null

  if (!hasSpaces) {
    return (
      <main className="rise mx-auto flex w-full max-w-[720px] flex-col gap-8 px-8 py-16">
        <div>
          <p className="text-sm font-medium text-accent">{greeting(now)}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Welcome to GoalTrail</h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
            One space for each thing you care about. Time, notes, and progress stay on this computer.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {['Create a space', 'Start a session', 'Look back on the week'].map((step, index) => (
            <li key={step} className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <p className="text-xs font-medium text-accent">Step {index + 1}</p>
              <p className="mt-2 text-sm font-medium">{step}</p>
            </li>
          ))}
        </ol>
        <Button
          onClick={() => {
            onCreateSpace()
          }}
        >
          Create your first space
        </Button>
      </main>
    )
  }

  return (
    <main className="rise mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">{greeting(now)}</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {view && view.todaySec > 0
              ? `You've focused ${formatHoursMinutes(view.todaySec)} today.`
              : 'A fresh day. Start a session when you are ready.'}
          </p>
        </div>
        <div className="relative">
          <Button
            onClick={() => {
              setPicking((open) => !open)
            }}
            aria-expanded={picking}
          >
            <Play size={16} />
            Start session
          </Button>
          {picking ? (
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-md border border-border bg-raised p-1 shadow-card">
              {startable.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">No spaces to start.</p>
              ) : (
                startable.map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent-soft"
                    onClick={() => {
                      setPicking(false)
                      void timer.start(space.id)
                    }}
                  >
                    <IconTile icon={space.icon} color={space.color} size="sm" />
                    <span className="truncate">{space.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!view && !error ? <DashboardSkeleton /> : null}
      {view && stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Clock} label="Today" seconds={view.todaySec} delta={stats.todayDelta} />
            <StatCard icon={CalendarDays} label="This week" seconds={view.weekSec} delta={stats.weekDelta} />
            <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
                <Flame size={16} className="text-warning" />
                Streak
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {view.streakDays}
                <span className="ml-1 text-base font-medium text-muted">
                  {view.streakDays === 1 ? 'day' : 'days'}
                </span>
              </p>
              <p className="mt-1 text-xs text-faint">
                {view.todaySec === 0 && view.streakDays > 0
                  ? 'Keep it going, track today'
                  : view.streakDays === 0
                    ? 'Track today to start a streak'
                    : 'Days in a row'}
              </p>
              <div
                className="mt-3 flex gap-2"
                role="img"
                aria-label={weekDotsLabel(stats.weekDots, settings.weekStartsOn)}
              >
                {stats.weekDots.map((dot) => (
                  <span key={dot.date} className="flex w-4 flex-col items-center gap-1" title={dot.label}>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        dot.filled ? 'bg-accent' : dot.future ? 'border border-border' : 'bg-border'
                      }`}
                    />
                    <span className="text-[10px] leading-none text-faint">{dot.letter}</span>
                  </span>
                ))}
              </div>
            </article>
            <StatCard icon={TrendingUp} label="Total time" seconds={stats.totalSec} delta={stats.monthDelta} />
          </div>
          <DashboardCharts
            days={view.days}
            shares={view.shares}
            spaces={source?.spaces ?? []}
            range={range}
            onRange={setRange}
          />
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Heatmap days={source?.daySeconds ?? []} weekStartsOn={settings.weekStartsOn} />
            <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <h2 className="text-base font-semibold tracking-tight">Insights</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {insightLines(source, spaces, timer.now).length === 0 ? (
                  <li>Add a target to a space and the pace shows up here.</li>
                ) : (
                  insightLines(source, spaces, timer.now).map((line) => <li key={line}>{line}</li>)
                )}
              </ul>
            </article>
          </div>
          <section>
            <h2 className="text-base font-semibold tracking-tight">Active spaces</h2>
            {view.active.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No active spaces. Restore one from the sidebar to see it here.</p>
            ) : (
              <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {view.active.map((card) => {
                  const space = byId.get(card.id)
                  const openHere = timer.session?.spaceId === card.id
                  const running = Boolean(openHere && timer.session?.running)
                  const days = space ? daysUntil(space.targetDate) : null
                  return (
                    <li key={card.id}>
                      <article className="flex h-full flex-col rounded-lg border border-border bg-surface p-4 shadow-card transition duration-150 ease-out hover:-translate-y-0.5 hover:border-line">
                        <button
                          type="button"
                          className="flex items-start gap-3 text-left"
                          onClick={() => {
                            onOpenSpace(card.id)
                          }}
                        >
                          <IconTile icon={card.icon} color={card.color} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-medium">{card.name}</span>
                            <span className="mt-0.5 line-clamp-1 block text-sm text-muted">
                              {space?.description || 'Open this space'}
                            </span>
                          </span>
                        </button>
                        <div className="mt-4">
                          <div className="h-1.5 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${card.percent ?? 0}%`, backgroundColor: card.color }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                            <span className="tabular-nums">
                              {space?.targetHours ? `${space.targetHours}h target` : formatHoursMinutes(card.loggedSec)}
                              {card.percent === null ? '' : ` · ${card.percent}%`}
                            </span>
                            {days !== null ? (
                              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                                {days > 0 ? `${days}d left` : days === 0 ? 'Due today' : 'Past target'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            aria-label={running ? 'Pause timer' : openHere ? 'Resume timer' : 'Start timer'}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition duration-150 ease-out hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
                            style={{ backgroundColor: card.color }}
                            onClick={() => {
                              if (running) void timer.pause()
                              else void timer.start(card.id)
                            }}
                          >
                            {running ? <Square size={14} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                          </button>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-base font-semibold tracking-tight">Recent notes</h2>
            {source && source.recentNotes.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center">
                <Timer className="mx-auto text-faint" size={28} />
                <p className="mt-3 text-sm font-medium">No notes yet</p>
                <p className="mt-1 text-sm text-muted">Open a space and write the first note for that goal.</p>
              </div>
            ) : (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {source?.recentNotes.map((note) => {
                  const space = byId.get(note.spaceId)
                  return (
                    <li key={note.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-left shadow-card transition duration-150 ease-out hover:border-line"
                        onClick={() => {
                          onOpenNote(note.spaceId, note.id)
                        }}
                      >
                        <span className="block truncate text-sm font-medium">{note.title || 'Untitled'}</span>
                        <span className="mt-2 flex items-center gap-2 text-xs text-muted">
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{
                              backgroundColor: space ? `color-mix(in srgb, ${space.color} 14%, transparent)` : undefined,
                              color: space?.color
                            }}
                          >
                            {note.spaceName}
                          </span>
                          <span>{formatSessionDate(note.updatedAt)}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
      {visibleCheer ? (
        <Celebration
          message={visibleCheer.text}
          onDone={() => {
            localStorage.setItem(`goaltrail.celebrated.${visibleCheer.key}`, '1')
            setGoneCheer(visibleCheer.key)
          }}
        />
      ) : null}
    </main>
  )
}

function celebration(
  view: ReturnType<typeof assembleDashboard> | null,
  source: DashboardSource | null,
  spaces: Space[],
  now: number
): { key: string; text: string } | null {
  if (!view || !source) return null
  const notes: { key: string; text: string }[] = []
  for (const mark of [3, 7, 30]) {
    if (view.streakDays === mark) {
      notes.push({ key: `streak-${mark}`, text: `${mark} days in a row. Keep the streak.` })
    }
  }
  const bySpace = new Map(spaces.map((space) => [space.id, space]))
  for (const card of source.spaces) {
    const space = bySpace.get(card.id)
    if (!space || space.targetHours === null || space.targetHours <= 0) continue
    if (card.loggedSec >= space.targetHours * 3600) {
      notes.push({ key: `done-${card.id}`, text: `${card.name} reached its target.` })
    }
  }
  if (isBestDaySoFar(source, now)) {
    notes.push({ key: `best-${localDateKey(new Date(now))}`, text: 'That is your best day so far.' })
  }
  return notes.find((note) => localStorage.getItem(`goaltrail.celebrated.${note.key}`) !== '1') ?? null
}

function insightLines(source: DashboardSource | null, spaces: Space[], now = Date.now()): string[] {
  if (!source) return []
  const byId = new Map(spaces.map((space) => [space.id, space]))
  const liveExtra = source.live
    ? Math.max(0, Math.floor((now - Date.parse(source.live.resumedAt)) / 1000))
    : 0
  const liveDate = source.live ? localDateKey(new Date(source.live.startedAt)) : ''
  return source.spaces
    .map((card) => {
      const space = byId.get(card.id)
      if (!space) return null
      const window = paceWindow(space.createdAt, new Date(now))
      const byDate = new Map<string, number>()
      for (const day of source.spaceDays) {
        if (day.spaceId !== space.id) continue
        byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.sec)
      }
      if (source.live?.spaceId === space.id && liveDate >= window.start && liveDate <= window.today) {
        byDate.set(liveDate, (byDate.get(liveDate) ?? 0) + liveExtra)
      }
      const logged = card.loggedSec + (source.live?.spaceId === space.id ? liveExtra : 0)
      const recent = secondsInWindow(
        [...byDate.entries()].map(([date, sec]) => ({ date, sec })),
        window.start,
        window.today
      )
      return goalInsight(space, logged, recent, window.days, new Date(now))
    })
    .filter((line): line is string => Boolean(line))
    .slice(0, 3)
}

function StatCard({
  icon: Icon,
  label,
  seconds,
  delta
}: {
  icon: typeof Clock
  label: string
  seconds: number
  delta: number | null
}): React.JSX.Element {
  const up = delta !== null && delta > 0
  const down = delta !== null && delta < 0
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <Icon size={16} strokeWidth={1.75} />
        {label}
      </div>
      <p className="mt-3">
        <Duration seconds={seconds} />
      </p>
      {delta === null ? (
        <p className="mt-1 text-xs text-faint">No earlier period to compare</p>
      ) : (
        <p className={`mt-1 text-xs font-medium tabular-nums ${up ? 'text-success' : down ? 'text-danger' : 'text-faint'}`}>
          {delta > 0 ? `+${delta}%` : `${delta}%`} vs previous
        </p>
      )}
    </article>
  )
}

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="shimmer h-28 rounded-lg border border-border" />
      ))}
    </div>
  )
}

function greeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return null
  const target = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

interface WeekDot {
  date: string
  filled: boolean
  future: boolean
  label: string
  letter: string
}

function periodStats(
  source: DashboardSource,
  todaySec: number,
  weekSec: number,
  weekStartsOn: number,
  now: number
): {
  todayDelta: number | null
  weekDelta: number | null
  monthDelta: number | null
  totalSec: number
  weekDots: WeekDot[]
} {
  const totals = new Map<string, number>()
  for (const day of source.daySeconds) totals.set(day.date, (totals.get(day.date) ?? 0) + day.sec)
  if (source.live) {
    const key = localDateKey(new Date(source.live.startedAt))
    const extra = Math.max(0, Math.floor((now - Date.parse(source.live.resumedAt)) / 1000))
    totals.set(key, (totals.get(key) ?? 0) + extra)
  }
  const today = new Date(now)
  const todayKey = localDateKey(today)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const weekStart = startOfWeek(today, weekStartsOn)
  const daysSoFar = Math.round((today.setHours(0, 0, 0, 0) - weekStart.getTime()) / 86400000) + 1
  const previousStart = new Date(weekStart)
  previousStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  let totalSec = 0
  for (const sec of totals.values()) totalSec += sec
  const dots: WeekDot[] = []
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + index)
    const date = localDateKey(day)
    const future = date > todayKey
    dots.push({
      date,
      filled: !future && (totals.get(date) ?? 0) > 0,
      future,
      label: day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      letter: day.toLocaleDateString(undefined, { weekday: 'narrow' })
    })
  }
  return {
    todayDelta: delta(todaySec, totals.get(localDateKey(yesterday)) ?? 0),
    weekDelta: delta(weekSec, sumDays(totals, previousStart, daysSoFar)),
    monthDelta: delta(sumDays(totals, monthStart, today.getDate()), sumDays(totals, prevMonthStart, prevMonthDays)),
    totalSec,
    weekDots: dots
  }
}

function weekDotsLabel(dots: WeekDot[], weekStartsOn: number): string {
  const start = WEEKDAY_LABELS[weekStartsOn] ?? 'Monday'
  const studied = dots.filter((dot) => dot.filled).map((dot) => dot.label)
  if (studied.length === 0) return `This week starting ${start}. No days tracked yet.`
  return `This week starting ${start}. Tracked ${studied.join(', ')}.`
}

function sumDays(totals: Map<string, number>, start: Date, count: number): number {
  let sec = 0
  for (let index = 0; index < count; index += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    sec += totals.get(localDateKey(day)) ?? 0
  }
  return sec
}

function delta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0
  return Math.round(((current - previous) / previous) * 100)
}
