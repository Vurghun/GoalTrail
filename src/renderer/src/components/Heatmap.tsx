import type { DaySeconds } from '@shared/progress'
import { WEEK_STARTS_ON, formatHoursMinutes, localDateKey, startOfWeek } from '@shared/time'

export function Heatmap({
  days,
  weeks = 12,
  color = 'var(--accent)',
  weekStartsOn = WEEK_STARTS_ON
}: {
  days: DaySeconds[]
  weeks?: number
  color?: string
  weekStartsOn?: number
}): React.JSX.Element {
  const byDate = new Map(days.map((day) => [day.date, day.sec]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = startOfWeek(today, weekStartsOn)
  start.setDate(start.getDate() - 7 * (weeks - 1))
  const cells: DaySeconds[] = []
  for (let index = 0; index < weeks * 7; index += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    if (day.getTime() > today.getTime()) break
    const date = localDateKey(day)
    cells.push({ date, sec: byDate.get(date) ?? 0 })
  }
  const max = Math.max(1, ...cells.map((cell) => cell.sec))
  const streak = new Set<string>()
  let run = 0
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const cell = cells[index]
    if (!cell || cell.sec <= 0) break
    streak.add(cell.date)
    run += 1
  }
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Last {weeks} weeks</h2>
        <p className="text-xs text-faint">{run > 1 ? `${run}-day streak` : 'Each square is a day'}</p>
      </div>
      <div className="mt-4 grid grid-flow-col grid-rows-7 gap-1" aria-label="Tracked days">
        {cells.map((cell) => (
          <span
            key={cell.date}
            title={`${cell.date}: ${formatHoursMinutes(cell.sec)}`}
            className={`h-3.5 w-3.5 rounded-sm ${streak.has(cell.date) ? 'ring-1 ring-accent' : ''}`}
            style={{
              backgroundColor: cell.sec > 0 ? color : 'var(--border)',
              opacity: cell.sec > 0 ? 0.28 + 0.72 * (cell.sec / max) : 1
            }}
          />
        ))}
      </div>
    </article>
  )
}
