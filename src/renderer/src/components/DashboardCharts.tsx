import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { DashboardDay, DashboardShare } from '@shared/dashboard'
import { formatHoursMinutes } from '@shared/time'

interface ChartSpace {
  id: string
  name: string
  color: string
}

interface DashboardChartsProps {
  days: DashboardDay[]
  shares: DashboardShare[]
  spaces: ChartSpace[]
  range: 7 | 30
  onRange: (range: 7 | 30) => void
}

export function DashboardCharts({
  days,
  shares,
  spaces,
  range,
  onRange
}: DashboardChartsProps): React.JSX.Element {
  const scale = chartScale(Math.max(...days.map((day) => day.sec), 0))
  const series = seriesFor(days, spaces)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const rows = days.map((day) => {
    const row: Record<string, string | number> = {
      label: day.label,
      date: day.date,
      stub: day.sec === 0 ? Math.max(1, Math.round(scale.max * 0.02)) : 0
    }
    for (const part of day.parts) row[part.id] = part.sec
    return row
  })
  const total = shares.reduce((sum, share) => sum + share.sec, 0)
  const grid = 'var(--border)'
  const axis = 'var(--faint)'

  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Time per day</h2>
          <div
            className="flex rounded-md border border-border bg-bg p-1"
            role="group"
            aria-label="Chart range"
          >
            <RangeButton
              label="7d"
              selected={range === 7}
              onClick={() => {
                onRange(7)
              }}
            />
            <RangeButton
              label="30d"
              selected={range === 30}
              onClick={() => {
                onRange(30)
              }}
            />
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: axis, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={range === 30 ? 4 : 0}
              />
              <YAxis
                domain={[0, scale.max]}
                ticks={scale.ticks}
                tick={{ fill: axis, fontSize: 12 }}
                width={56}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => formatTick(value)}
              />
              <Tooltip
                cursor={{ fill: 'var(--accent-soft)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const lines = payload.filter(
                    (item) => item.dataKey !== 'stub' && Number(item.value) > 0
                  )
                  const sec = lines.reduce((sum, item) => sum + Number(item.value ?? 0), 0)
                  return (
                    <div className="rounded-md border border-border bg-raised px-3 py-2 text-sm shadow-card">
                      <p className="font-medium">{label}</p>
                      <p className="mt-1 text-muted tabular-nums">{formatHoursMinutes(sec)}</p>
                      {lines.length > 1 ? (
                        <ul className="mt-2 space-y-1">
                          {lines.map((item) => (
                            <li
                              key={String(item.dataKey)}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: item.color }}
                              />
                              <span className="min-w-0 flex-1 truncate">{item.name}</span>
                              <span className="tabular-nums">
                                {formatHoursMinutes(Number(item.value))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="stub"
                name="None"
                stackId="time"
                fill="var(--border)"
                legendType="none"
                isAnimationActive={false}
              />
              {series.map((space, index) => (
                <Bar
                  key={space.id}
                  dataKey={space.id}
                  name={space.name}
                  stackId="time"
                  fill={inkFill(index)}
                  radius={index === series.length - 1 ? [4, 4, 0, 0] : undefined}
                  animationDuration={280}
                  isAnimationActive={!reduceMotion}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {series.length > 1 ? (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {series.map((space, index) => (
              <li key={space.id} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: inkFill(index) }} />
                {space.name}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 className="text-base font-semibold tracking-tight">Time per space</h2>
        {shares.length === 0 ? (
          <p className="mt-8 text-sm text-muted">No time tracked yet.</p>
        ) : (
          <>
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shares}
                    dataKey="sec"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={84}
                    paddingAngle={1}
                    cornerRadius={2}
                    isAnimationActive={!reduceMotion}
                    stroke="none"
                  >
                    {shares.map((share, index) => (
                      <Cell key={share.id} fill={inkFill(index)} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const item = payload[0]?.payload as DashboardShare | undefined
                      if (!item) return null
                      return (
                        <div className="rounded-md border border-border bg-raised px-3 py-2 text-sm shadow-card">
                          <p className="font-medium">{item.name}</p>
                          <p className="mt-1 text-muted tabular-nums">
                            {formatHoursMinutes(item.sec)}
                          </p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold tracking-tight tabular-nums">
                  {formatHoursMinutes(total)}
                </span>
                <span className="text-xs text-faint">total</span>
              </div>
            </div>
            <ul className="mt-2 space-y-2">
              {shares.map((share, index) => (
                <li key={share.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: inkFill(index) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{share.name}</span>
                  <span className="text-muted tabular-nums">{formatHoursMinutes(share.sec)}</span>
                  <span className="w-10 text-right text-faint tabular-nums">
                    {total === 0 ? 0 : Math.round((share.sec / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

const INK_FILLS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)'
]

function inkFill(index: number): string {
  return INK_FILLS[index % INK_FILLS.length] ?? 'var(--chart-1)'
}

function seriesFor(days: DashboardDay[], spaces: ChartSpace[]): ChartSpace[] {
  const totals = new Map<string, number>()
  for (const day of days) {
    for (const part of day.parts) totals.set(part.id, (totals.get(part.id) ?? 0) + part.sec)
  }
  return [...totals.entries()]
    .filter(([, sec]) => sec > 0)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => spaces.find((space) => space.id === id))
    .filter((space): space is ChartSpace => Boolean(space))
}

function RangeButton({
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
      aria-pressed={selected}
      className={`rounded-sm px-2.5 py-1 text-xs font-medium transition duration-150 ease-out ${
        selected ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function chartScale(maxSec: number): { ticks: number[]; max: number } {
  const steps = [15, 30, 60, 90, 120, 180, 240, 360, 480, 720].map((minutes) => minutes * 60)
  const target = Math.max(maxSec, 15 * 60)
  let step = steps[0] ?? 900
  for (const candidate of steps) {
    if (candidate * 4 >= target) {
      step = candidate
      break
    }
    step = candidate
  }
  if (step * 4 < target) step = Math.ceil(target / 4 / 3600) * 3600
  const max = Math.max(step, Math.ceil(target / step) * step)
  const ticks: number[] = []
  for (let value = 0; value <= max; value += step) ticks.push(value)
  return { ticks, max }
}

function formatTick(sec: number): string {
  const minutes = Math.round(sec / 60)
  if (minutes <= 0) return '0'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}
