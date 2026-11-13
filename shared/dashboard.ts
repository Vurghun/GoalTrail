import { isInCurrentWeek, scorePercent, streakFromDays, type DaySeconds } from './progress'
import type { SpaceStatus } from './spaces'
import { WEEK_STARTS_ON, localDateKey } from './time'

export const DASHBOARD_RANGES = [7, 30] as const
export type DashboardRange = (typeof DASHBOARD_RANGES)[number]
export const RECENT_NOTE_LIMIT = 8

export interface DashboardSpace {
  id: string
  name: string
  color: string
  icon: string
  status: SpaceStatus
  loggedSec: number
  targetHours: number | null
  milestoneDone: number
  milestoneTotal: number
}

export interface DashboardNote {
  id: string
  spaceId: string
  spaceName: string
  title: string
  updatedAt: string
}

export interface SpaceDay {
  date: string
  spaceId: string
  sec: number
}

export interface DashboardSource {
  daySeconds: DaySeconds[]
  spaceDays: SpaceDay[]
  spaces: DashboardSpace[]
  live: { spaceId: string; startedAt: string; resumedAt: string } | null
  recentNotes: DashboardNote[]
}

export interface DashboardDay {
  date: string
  label: string
  sec: number
  parts: { id: string; sec: number }[]
}

export interface DashboardShare {
  id: string
  name: string
  color: string
  sec: number
}

export interface DashboardCard {
  id: string
  name: string
  color: string
  icon: string
  percent: number | null
  loggedSec: number
}

export interface DashboardView {
  todaySec: number
  weekSec: number
  streakDays: number
  days: DashboardDay[]
  shares: DashboardShare[]
  active: DashboardCard[]
}

export function assembleDashboard(
  source: DashboardSource,
  now: number,
  range: DashboardRange,
  weekStartsOn = WEEK_STARTS_ON
): DashboardView {
  const totals = new Map<string, number>()
  const parts = new Map<string, Map<string, number>>()
  for (const day of source.spaceDays) {
    totals.set(day.date, (totals.get(day.date) ?? 0) + day.sec)
    const bucket = parts.get(day.date) ?? new Map<string, number>()
    bucket.set(day.spaceId, (bucket.get(day.spaceId) ?? 0) + day.sec)
    parts.set(day.date, bucket)
  }
  for (const day of source.daySeconds) {
    if (!totals.has(day.date)) totals.set(day.date, day.sec)
  }

  let liveExtra = 0
  let liveKey = ''
  if (source.live) {
    liveExtra = Math.max(0, Math.floor((now - Date.parse(source.live.resumedAt)) / 1000))
    liveKey = localDateKey(new Date(source.live.startedAt))
    totals.set(liveKey, (totals.get(liveKey) ?? 0) + liveExtra)
    const bucket = parts.get(liveKey) ?? new Map<string, number>()
    bucket.set(source.live.spaceId, (bucket.get(source.live.spaceId) ?? 0) + liveExtra)
    parts.set(liveKey, bucket)
  }

  const today = localDateKey(new Date(now))
  let weekSec = 0
  const qualified: string[] = []
  for (const [date, sec] of totals) {
    if (isInCurrentWeek(date, now, weekStartsOn)) weekSec += sec
    if (sec > 0) qualified.push(date)
  }

  const days: DashboardDay[] = []
  for (let offset = range - 1; offset >= 0; offset -= 1) {
    const date = shiftDate(today, -offset)
    const bucket = parts.get(date)
    days.push({
      date,
      label: dayLabel(date),
      sec: totals.get(date) ?? 0,
      parts: bucket
        ? [...bucket.entries()].filter(([, sec]) => sec > 0).map(([id, sec]) => ({ id, sec }))
        : []
    })
  }

  const shares = source.spaces
    .map((space) => ({
      id: space.id,
      name: space.name,
      color: space.color,
      sec: space.loggedSec + (source.live?.spaceId === space.id ? liveExtra : 0)
    }))
    .filter((space) => space.sec > 0)
    .sort((a, b) => b.sec - a.sec)

  const active = source.spaces
    .filter((space) => space.status === 'active')
    .map((space) => {
      const loggedSec = space.loggedSec + (source.live?.spaceId === space.id ? liveExtra : 0)
      return {
        id: space.id,
        name: space.name,
        color: space.color,
        icon: space.icon,
        loggedSec,
        percent: scorePercent(
          loggedSec,
          space.targetHours,
          space.milestoneDone,
          space.milestoneTotal
        )
      }
    })

  return {
    todaySec: totals.get(today) ?? 0,
    weekSec,
    streakDays: streakFromDays(qualified, now).current,
    days,
    shares,
    active
  }
}

const BEST_DAY_MIN_SEC = 30 * 60

/** True when today, including a running session, beats every other day on record. */
export function isBestDaySoFar(source: DashboardSource, now: number): boolean {
  const totals = new Map<string, number>()
  for (const day of source.daySeconds) {
    totals.set(day.date, (totals.get(day.date) ?? 0) + day.sec)
  }
  if (source.live) {
    const extra = Math.max(0, Math.floor((now - Date.parse(source.live.resumedAt)) / 1000))
    const key = localDateKey(new Date(source.live.startedAt))
    totals.set(key, (totals.get(key) ?? 0) + extra)
  }
  const today = localDateKey(new Date(now))
  const todaySec = totals.get(today) ?? 0
  if (todaySec < BEST_DAY_MIN_SEC) return false
  let bestOther = 0
  for (const [date, sec] of totals) {
    if (date !== today && sec > bestOther) bestOther = sec
  }
  return todaySec > bestOther
}

function shiftDate(key: string, amount: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + amount)
  return localDateKey(date)
}

function dayLabel(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })
}
