import { WEEK_STARTS_ON, localDateKey } from './time'

export const MILESTONE_TITLE_MAX = 200
export const DAILY_GOAL_MAX = 24 * 60
export const WEEKLY_GOAL_MAX = 7 * 24 * 60
export const ACTIVITY_LIMIT = 40

export interface Milestone {
  id: string
  spaceId: string
  title: string
  done: boolean
  doneAt: string | null
  targetDate: string | null
  sortOrder: number
}

export interface MilestoneDraft {
  title: string
  targetDate: string | null
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none'

export interface DueDescription {
  label: string
  tone: DueTone
}

export interface SpaceGoals {
  dailyGoalMin: number | null
  weeklyGoalMin: number | null
}

export interface DaySeconds {
  date: string
  sec: number
}

export interface ActivityItem {
  id: string
  kind: 'session' | 'milestone' | 'note'
  at: string
  title: string
  detail: string
}

export interface ProgressSource {
  targetHours: number | null
  targetDate: string | null
  dailyGoalMin: number | null
  weeklyGoalMin: number | null
  milestones: Milestone[]
  daySeconds: DaySeconds[]
  live: { startedAt: string; resumedAt: string } | null
  activity: ActivityItem[]
}

export interface ProgressView {
  percent: number | null
  milestoneDone: number
  milestoneTotal: number
  milestonePercent: number | null
  loggedSec: number
  hoursPercent: number | null
  daysLeft: number | null
  todaySec: number
  weekSec: number
  dailyPercent: number | null
  weeklyPercent: number | null
  streakDays: number
  bestStreakDays: number
}

export function parseMilestoneDraft(input: unknown): MilestoneDraft {
  if (typeof input === 'string') return { title: parseMilestoneTitle(input), targetDate: null }
  if (!isRecord(input)) throw new Error('Milestone is invalid.')
  return {
    title: parseMilestoneTitle(input.title),
    targetDate: parseOptionalDate(input.targetDate)
  }
}

export function describeDue(
  targetDate: string | null,
  done: boolean,
  now = new Date()
): DueDescription {
  if (!targetDate) return { label: '', tone: 'none' }
  const today = localDateKey(now)
  const formatted = formatDueDate(targetDate)
  if (done) return { label: formatted, tone: 'later' }
  if (targetDate < today) {
    const days = daySpan(targetDate, today)
    return { label: days === 1 ? 'Overdue · 1 day' : `Overdue · ${days} days`, tone: 'overdue' }
  }
  if (targetDate === today) return { label: 'Due today', tone: 'today' }
  const days = daySpan(today, targetDate)
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' }
  if (days <= 7) return { label: `Due in ${days} days`, tone: 'soon' }
  return { label: formatted, tone: 'later' }
}

export function formatDueDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })
}

export function compareOpenMilestones(a: Milestone, b: Milestone, now = new Date()): number {
  const today = localDateKey(now)
  const rank = (milestone: Milestone): number => {
    if (!milestone.targetDate) return 2
    return milestone.targetDate < today ? 0 : 1
  }
  const difference = rank(a) - rank(b)
  if (difference !== 0) return difference
  if (a.targetDate && b.targetDate && a.targetDate !== b.targetDate) {
    return a.targetDate < b.targetDate ? -1 : 1
  }
  return a.sortOrder - b.sortOrder
}

export function parseMilestoneTitle(input: unknown): string {
  if (typeof input !== 'string') throw new Error('Milestone title is invalid.')
  const title = input.trim()
  if (title.length === 0) throw new Error('Milestone title is required.')
  if ([...title].length > MILESTONE_TITLE_MAX) {
    throw new Error(`Milestone title must be ${MILESTONE_TITLE_MAX} characters or fewer.`)
  }
  return title
}

export function parseSpaceGoals(input: unknown): SpaceGoals {
  if (!isRecord(input)) throw new Error('Goals are invalid.')
  return {
    dailyGoalMin: readGoalMinutes(input.dailyGoalMin, 'Daily goal', DAILY_GOAL_MAX),
    weeklyGoalMin: readGoalMinutes(input.weeklyGoalMin, 'Weekly goal', WEEKLY_GOAL_MAX)
  }
}

export function assembleProgress(
  source: ProgressSource,
  now = Date.now(),
  weekStartsOn = WEEK_STARTS_ON
): ProgressView {
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
  let loggedSec = 0
  let todaySec = 0
  let weekSec = 0
  const qualified: string[] = []
  for (const [date, sec] of totals) {
    loggedSec += sec
    if (date === today) todaySec += sec
    if (isInCurrentWeek(date, now, weekStartsOn)) weekSec += sec
    if (qualifies(sec, source.dailyGoalMin)) qualified.push(date)
  }

  const milestoneTotal = source.milestones.length
  const milestoneDone = source.milestones.filter((milestone) => milestone.done).length
  const milestonePercent =
    milestoneTotal === 0 ? null : Math.round((milestoneDone / milestoneTotal) * 100)
  const hoursPercent = hoursRatio(loggedSec, source.targetHours)
  const percent = scorePercent(loggedSec, source.targetHours, milestoneDone, milestoneTotal)
  const streaks = streakFromDays(qualified, now)

  return {
    percent,
    milestoneDone,
    milestoneTotal,
    milestonePercent,
    loggedSec,
    hoursPercent,
    daysLeft: source.targetDate ? daysBetween(today, source.targetDate) : null,
    todaySec,
    weekSec,
    dailyPercent: ratio(todaySec, source.dailyGoalMin),
    weeklyPercent: ratio(weekSec, source.weeklyGoalMin),
    streakDays: streaks.current,
    bestStreakDays: streaks.best
  }
}

export function streakFromDays(
  days: string[],
  now = Date.now()
): { current: number; best: number } {
  const unique = [...new Set(days)].sort()
  let best = 0
  let run = 0
  let previous = ''
  for (const day of unique) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1
    previous = day
    if (run > best) best = run
  }

  const today = localDateKey(new Date(now))
  const present = new Set(unique)
  let cursor = present.has(today) ? today : addDays(today, -1)
  if (!present.has(cursor)) return { current: 0, best }
  let current = 0
  while (present.has(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }
  return { current, best }
}

export function scorePercent(
  loggedSec: number,
  targetHours: number | null,
  milestoneDone: number,
  milestoneTotal: number
): number | null {
  const milestonePercent =
    milestoneTotal === 0 ? null : Math.round((milestoneDone / milestoneTotal) * 100)
  const hoursPercent = hoursRatio(loggedSec, targetHours)
  const parts = [milestonePercent, hoursPercent].filter((part): part is number => part !== null)
  if (parts.length === 0) return null
  return Math.round(parts.reduce((sum, part) => sum + part, 0) / parts.length)
}

export function isInCurrentWeek(
  dateKey: string,
  now = Date.now(),
  weekStartsOn = WEEK_STARTS_ON
): boolean {
  const start = startOfWeek(new Date(now), weekStartsOn)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const day = dateFromKey(dateKey)
  return day >= start && day < end
}

function qualifies(sec: number, dailyGoalMin: number | null): boolean {
  if (dailyGoalMin === null) return sec > 0
  return sec >= dailyGoalMin * 60
}

function hoursRatio(loggedSec: number, targetHours: number | null): number | null {
  if (targetHours === null) return null
  if (targetHours === 0) return 100
  return Math.min(100, Math.round((loggedSec / 3600 / targetHours) * 100))
}

function ratio(actualSec: number, goalMin: number | null): number | null {
  if (goalMin === null) return null
  return Math.min(100, Math.round((actualSec / (goalMin * 60)) * 100))
}

function daysBetween(fromKey: string, toKey: string): number {
  return daySpan(fromKey, toKey)
}

function daySpan(fromKey: string, toKey: string): number {
  const from = dateFromKey(fromKey)
  const to = dateFromKey(toKey)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function parseOptionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !isRealIsoDate(value)) {
    throw new Error('Choose a real date.')
  }
  return value
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

function startOfWeek(date: Date, weekStartsOn: number): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysSinceWeekStart = (start.getDay() - weekStartsOn + 7) % 7
  start.setDate(start.getDate() - daysSinceWeekStart)
  return start
}

function addDays(key: string, amount: number): string {
  const date = dateFromKey(key)
  date.setDate(date.getDate() + amount)
  return localDateKey(date)
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

function readGoalMinutes(value: unknown, label: string, max: number): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number of minutes.`)
  }
  if (value < 1 || value > max) {
    throw new Error(`${label} must be between 1 and ${max} minutes.`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
