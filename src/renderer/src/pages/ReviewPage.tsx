import { useEffect, useState } from 'react'
import type { WeeklyReview } from '@shared/review'
import { formatDueDate } from '@shared/progress'
import { formatHoursMinutes, formatSessionDate } from '@shared/time'
import { IconTile } from '@renderer/components/ui/IconTile'
import { useSessionsChanged } from '@renderer/hooks/useSessionsChanged'
import { errorMessage } from '@renderer/lib/errors'

export function ReviewPage(): React.JSX.Element {
  const [review, setReview] = useState<WeeklyReview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = (): void => {
      void window.api
        .getWeeklyReview()
        .then((next) => {
          if (!active) return
          setReview(next)
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
  }, [])

  useSessionsChanged(() => {
    void window.api
      .getWeeklyReview()
      .then(setReview)
      .catch((loadError: unknown) => {
        setError(errorMessage(loadError))
      })
  })

  const peak = review ? Math.max(review.thisSec, review.lastSec, 1) : 1

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-10 px-8 py-10">
      <header>
        <p className="text-sm text-faint">Weekly review</p>
        <h1 className="mt-2 text-[40px] font-semibold tracking-tight">This week</h1>
        {review ? (
          <p className="mt-3 text-sm text-muted">
            {formatDueDate(review.weekStart)} – {formatDueDate(review.weekEnd)}
            {review.activeDays > 0
              ? ` · ${review.activeDays} ${review.activeDays === 1 ? 'day' : 'days'} with time`
              : ''}
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!review && !error ? <div className="shimmer h-40 rounded-lg" /> : null}

      {review ? (
        <>
          <p className="max-w-xl text-xl font-medium leading-snug tracking-tight">
            {review.insight}
          </p>

          <section className="grid gap-3 sm:grid-cols-2">
            <Compare
              label="This week"
              seconds={review.thisSec}
              width={Math.round((review.thisSec / peak) * 100)}
            />
            <Compare
              label="Last week"
              seconds={review.lastSec}
              width={Math.round((review.lastSec / peak) * 100)}
            />
          </section>

          <section>
            <h2 className="text-base font-semibold tracking-tight">Time by space</h2>
            {review.spaces.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No sessions in the last two weeks.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {review.spaces.map((space) => {
                  const width = Math.round((space.thisSec / peak) * 100)
                  return (
                    <li key={space.id}>
                      <div className="flex items-center gap-3">
                        <IconTile icon={space.icon} color={space.color} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {space.name}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatHoursMinutes(space.thisSec)}
                        </span>
                        <span className="w-16 text-right text-xs text-muted tabular-nums">
                          {space.lastSec > 0 ? formatHoursMinutes(space.lastSec) : '—'}
                        </span>
                      </div>
                      <div className="meter mt-2" aria-hidden>
                        <div className="meter-fill" style={{ width: `${width}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-faint">The quiet number is last week.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold tracking-tight">Milestones finished</h2>
            {review.milestones.length === 0 ? (
              <p className="mt-3 text-sm text-muted">None finished this week.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {review.milestones.map((milestone) => (
                  <li key={milestone.id} className="flex items-baseline gap-3 py-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-text text-[10px] text-surface">
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{milestone.title}</span>
                      <span className="text-xs text-muted">{milestone.spaceName}</span>
                    </span>
                    <span className="text-xs text-muted">
                      {formatSessionDate(milestone.doneAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

function Compare({
  label,
  seconds,
  width
}: {
  label: string
  seconds: number
  width: number
}): React.JSX.Element {
  return (
    <article className="rounded-lg border border-border border-t-2 border-t-text bg-surface p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
        {formatHoursMinutes(seconds)}
      </p>
      <div className="meter mt-4" aria-hidden>
        <div className="meter-fill" style={{ width: `${width}%` }} />
      </div>
    </article>
  )
}
