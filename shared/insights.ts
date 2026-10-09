import type { DaySeconds } from './progress'
import type { Space } from './spaces'
import { localDateKey } from './time'

export const PACE_WINDOW_DAYS = 14

export function paceWindow(
  createdAt: string,
  now: Date
): { start: string; today: string; days: number } {
  const todayDate = new Date(now)
  todayDate.setHours(0, 0, 0, 0)
  const earliest = new Date(todayDate)
  earliest.setDate(todayDate.getDate() - (PACE_WINDOW_DAYS - 1))
  const created = new Date(createdAt)
  created.setHours(0, 0, 0, 0)
  const start = Number.isFinite(created.getTime()) && created > earliest ? created : earliest
  const days = Math.max(1, Math.round((todayDate.getTime() - start.getTime()) / 86400000) + 1)
  return { start: localDateKey(start), today: localDateKey(todayDate), days }
}

export function secondsInWindow(days: DaySeconds[], start: string, today: string): number {
  let sec = 0
  for (const day of days) {
    if (day.date >= start && day.date <= today) sec += day.sec
  }
  return sec
}

export function goalInsight(
  space: Space,
  loggedSec: number,
  recentSec: number,
  windowDays: number,
  now = new Date()
): string | null {
  if (space.status === 'archived' || space.targetHours === null || space.targetHours <= 0) return null
  const targetSec = space.targetHours * 3600
  const remaining = targetSec - loggedSec
  if (remaining <= 0) return `${space.name} has reached its ${space.targetHours}h target.`

  if (space.targetDate) {
    const [year, month, day] = space.targetDate.split('-').map(Number)
    if (year !== undefined && month !== undefined && day !== undefined) {
      const target = new Date(year, month - 1, day)
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const daysLeft = Math.round((target.getTime() - today.getTime()) / 86400000)
      if (daysLeft < 0) return `${space.name} is past ${space.targetDate}, with time still left on the target.`
      const days = Math.max(1, daysLeft)
      const perDay = Math.max(1, Math.ceil(remaining / days / 60))
      if (days === 1) return `${space.name} needs ${perDay}m today to hit its target.`
      return `${space.name} needs ${perDay}m a day to hit ${space.targetDate}.`
    }
  }

  if (recentSec < 60) return `No tracked time on ${space.name} in the last ${windowDays} days.`
  const perDay = recentSec / Math.max(1, windowDays)
  const daysLeft = Math.ceil(remaining / perDay)
  const finish = new Date(now)
  finish.setDate(finish.getDate() + daysLeft)
  const label = finish.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `At the last ${windowDays} days' pace, ${space.name} finishes around ${label}.`
}
