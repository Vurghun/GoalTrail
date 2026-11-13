import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { assembleProgress, parseSpaceGoals, type ProgressSource } from '@shared/progress'
import type { Space } from '@shared/spaces'
import { goalInsight, paceWindow, secondsInWindow } from '@shared/insights'
import { formatHoursMinutes, formatSessionDate, localDateKey } from '@shared/time'
import { Heatmap } from '@renderer/components/Heatmap'
import { Button } from '@renderer/components/ui/Button'
import { fieldClass } from '@renderer/components/ui/styles'
import { useSessionsChanged } from '@renderer/hooks/useSessionsChanged'
import { useSettings } from '@renderer/hooks/useSettings'
import { errorMessage } from '@renderer/lib/errors'
import type { useTimer } from '@renderer/hooks/useTimer'

type TimerApi = ReturnType<typeof useTimer>

interface ProgressPanelProps {
  space: Space
  timer: TimerApi
  onGoals: (dailyGoalMin: number | null, weeklyGoalMin: number | null) => Promise<void>
  onOpenMilestones: () => void
}

export function ProgressPanel({
  space,
  timer,
  onGoals,
  onOpenMilestones
}: ProgressPanelProps): React.JSX.Element {
  const { settings } = useSettings()
  const [source, setSource] = useState<ProgressSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [daily, setDaily] = useState(space.dailyGoalMin === null ? '' : String(space.dailyGoalMin))
  const [weekly, setWeekly] = useState(
    space.weeklyGoalMin === null ? '' : String(space.weeklyGoalMin)
  )
  useSessionsChanged(() => {
    setReloadToken((value) => value + 1)
  })

  useEffect(() => {
    let active = true
    void window.api
      .getProgress(space.id)
      .then((next) => {
        if (!active) return
        setSource(next)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [space.id, reloadToken, timer.session?.id, timer.session?.running, timer.session?.durationSec])

  const view = source ? assembleProgress(source, timer.now, settings.weekStartsOn) : null

  function reload(): void {
    setReloadToken((value) => value + 1)
  }

  async function saveGoals(): Promise<void> {
    const goals = parseSpaceGoals({
      dailyGoalMin: minutesOrEmpty(daily, 'Daily goal'),
      weeklyGoalMin: minutesOrEmpty(weekly, 'Weekly goal')
    })
    await onGoals(goals.dailyGoalMin, goals.weeklyGoalMin)
    reload()
  }

  return (
    <section className="flex flex-col gap-6 py-8">
      <p className="text-sm text-muted">
        The score averages finished milestones and hours toward the target.
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading && !view ? (
        <p className="text-sm text-muted">Loading progress…</p>
      ) : view ? (
        <>
          {source ? (
            <div className="space-y-3">
              <Heatmap days={source.daySeconds} weekStartsOn={settings.weekStartsOn} />
              <PaceLine space={space} source={source} loggedSec={view.loggedSec} now={timer.now} />
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <p className="text-3xl font-semibold tracking-tight">
                {view.percent === null ? '—' : `${view.percent}%`}
              </p>
              <p className="mt-1 text-sm text-muted">
                {view.percent === null
                  ? 'Add milestones or a target hours number to score this space.'
                  : 'Overall progress'}
              </p>
              {view.percent !== null ? <Meter percent={view.percent} /> : null}
            </article>
            <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <p className="text-3xl font-semibold tracking-tight">
                {view.streakDays === 0 ? '0' : view.streakDays}
              </p>
              <p className="mt-1 text-sm text-muted">Day streak</p>
              <p className="mt-2 text-sm">Best {view.bestStreakDays}</p>
              <p className="mt-1 text-xs text-muted">
                {space.dailyGoalMin === null
                  ? 'Any tracked time keeps the streak going.'
                  : `A day counts after ${space.dailyGoalMin} minutes.`}
              </p>
            </article>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Stat
              label="Hours"
              value={
                space.targetHours === null
                  ? formatHoursMinutes(view.loggedSec)
                  : `${formatHoursMinutes(view.loggedSec)} / ${space.targetHours}h`
              }
            />
            <Stat label="Target date" value={dateLabel(view.daysLeft)} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <h3 className="text-sm font-medium">Goals</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <GoalMeter
                label="Today"
                spent={formatHoursMinutes(view.todaySec)}
                goal={space.dailyGoalMin}
                percent={view.dailyPercent}
              />
              <GoalMeter
                label="This week"
                spent={formatHoursMinutes(view.weekSec)}
                goal={space.weeklyGoalMin}
                percent={view.weeklyPercent}
              />
            </div>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault()
                void saveGoals().catch((saveError: unknown) => {
                  setError(errorMessage(saveError))
                })
              }}
            >
              <label className="text-sm">
                <span className="mb-1 block font-medium">Daily minutes</span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={daily}
                  placeholder="30"
                  aria-label="Daily goal minutes"
                  onChange={(event) => {
                    setDaily(event.target.value)
                  }}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Weekly minutes</span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={weekly}
                  placeholder="150"
                  aria-label="Weekly goal minutes"
                  onChange={(event) => {
                    setWeekly(event.target.value)
                  }}
                />
              </label>
              <Button type="submit">Save goals</Button>
            </form>
          </div>

          <button
            type="button"
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 text-left transition duration-150 ease-out hover:border-line"
            onClick={onOpenMilestones}
          >
            <span className="text-sm font-medium">Milestones</span>
            <span className="flex items-center gap-2 text-sm text-muted tabular-nums">
              {view.milestoneTotal === 0
                ? 'None yet'
                : `${view.milestoneDone} of ${view.milestoneTotal}`}
              <ChevronRight size={16} />
            </span>
          </button>

          <div>
            <h3 className="text-sm font-medium">Activity</h3>
            {source && source.activity.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Time you track, milestones you finish, and notes you add show up here.
              </p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3 border-l border-border pl-4">
                {source?.activity.map((item) => (
                  <li key={item.id}>
                    <p className="text-sm">{item.title}</p>
                    <p className="text-xs text-muted">
                      {formatSessionDate(item.at)}
                      {item.detail ? ` · ${item.detail}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}

function Meter({ percent }: { percent: number }): React.JSX.Element {
  return (
    <div className="mt-3 h-px overflow-hidden bg-border">
      <div className="meter-fill h-px bg-text" style={{ width: `${percent}%` }} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </article>
  )
}

function GoalMeter({
  label,
  spent,
  goal,
  percent
}: {
  label: string
  spent: string
  goal: number | null
  percent: number | null
}): React.JSX.Element {
  return (
    <div>
      <p className="text-sm">
        {label}: {spent}
        {goal === null ? '' : ` / ${goal}m`}
      </p>
      {percent !== null ? <Meter percent={percent} /> : null}
    </div>
  )
}

function dateLabel(daysLeft: number | null): string {
  if (daysLeft === null) return 'No target date'
  if (daysLeft > 1) return `${daysLeft} days left`
  if (daysLeft === 1) return '1 day left'
  if (daysLeft === 0) return 'Target date is today'
  if (daysLeft === -1) return '1 day past the target date'
  return `${Math.abs(daysLeft)} days past the target date`
}

function PaceLine({
  space,
  source,
  loggedSec,
  now
}: {
  space: Space
  source: ProgressSource
  loggedSec: number
  now: number
}): React.JSX.Element | null {
  const window = paceWindow(space.createdAt, new Date(now))
  const days = source.daySeconds.map((day) => ({ ...day }))
  if (source.live) {
    const extra = Math.max(0, Math.floor((now - Date.parse(source.live.resumedAt)) / 1000))
    const date = localDateKey(new Date(source.live.startedAt))
    const existing = days.find((day) => day.date === date)
    if (existing) existing.sec += extra
    else days.push({ date, sec: extra })
  }
  const line = goalInsight(
    space,
    loggedSec,
    secondsInWindow(days, window.start, window.today),
    window.days,
    new Date(now)
  )
  if (!line) return null
  return <p className="text-sm text-muted">{line}</p>
}

function minutesOrEmpty(value: string, label: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) throw new Error(`${label} must be a whole number of minutes.`)
  return Number(trimmed)
}
